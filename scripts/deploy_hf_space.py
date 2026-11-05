#!/usr/bin/env python
r"""Deploy the FRIKHII Copilot backend to a Hugging Face Docker Space.

The script reads local service .env files, uploads a clean build context that
never contains those files, sets Space secrets, waits for the Space to start,
and (optionally) points the GitHub Pages frontend at the new API URL.

Usage:
    python scripts/deploy_hf_space.py --token-file C:\path\to\hf_token.txt
    python scripts/deploy_hf_space.py --skip-frontend

Create a Hugging Face token at https://huggingface.co/settings/tokens with
write access to Spaces. Do not commit the token.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
HF_DIR = ROOT / "deploy" / "huggingface"
CORE_ENV = ROOT / "services" / "core-api" / ".env"
AI_ENV = ROOT / "services" / "ai-engine" / ".env"
CONFIG_JS = ROOT / "apps" / "web" / "public" / "config.js"
DEFAULT_TOKEN_FILE = Path(tempfile.gettempdir()) / "opencode" / "hf_token.txt"
DEFAULT_SPACE_NAME = "frikhii-copilot-api"


def log(message: str) -> None:
    print(message, flush=True)


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if key:
            values[key] = value
    return values


def read_token(args: argparse.Namespace) -> str:
    token = os.environ.get("HF_TOKEN", "").strip()
    if token:
        return token
    token_file = Path(args.token_file) if args.token_file else DEFAULT_TOKEN_FILE
    if token_file.exists():
        token = token_file.read_text(encoding="utf-8").strip()
        if token:
            return token
    raise SystemExit(
        "No Hugging Face token found.\n"
        f"Create a write token at https://huggingface.co/settings/tokens and save it to:\n  {token_file}\n"
        "or set the HF_TOKEN environment variable. Never paste the token into chat."
    )


def copy_service(source: Path, destination: Path) -> None:
    ignored = shutil.ignore_patterns(
        ".env",
        ".env.*",
        "__pycache__",
        "*.pyc",
        "*.pyo",
        ".pytest_cache",
        ".mypy_cache",
        ".ruff_cache",
        ".venv",
        "venv",
        "tests",
        "node_modules",
        "dist",
        ".git",
        "*.log",
    )
    shutil.copytree(source, destination, ignore=ignored, dirs_exist_ok=True)


def build_staging() -> Path:
    staging = Path(tempfile.mkdtemp(prefix="frikhii-hf-space-"))
    log(f"Preparing clean Space build context: {staging}")

    for name in ("Dockerfile", "start.sh", ".dockerignore", "README.md"):
        shutil.copy2(HF_DIR / name, staging / name)

    (staging / "services").mkdir(parents=True, exist_ok=True)
    copy_service(ROOT / "services" / "core-api", staging / "services" / "core-api")
    copy_service(ROOT / "services" / "ai-engine", staging / "services" / "ai-engine")

    leaked = [p for p in staging.rglob(".env*") if p.is_file()]
    if leaked:
        for path in leaked:
            path.unlink()
        raise SystemExit(f"Refusing to upload: environment files leaked into staging: {leaked}")

    total = sum(p.stat().st_size for p in staging.rglob("*") if p.is_file())
    files = sum(1 for p in staging.rglob("*") if p.is_file())
    log(f"Staging contains {files} files ({total / 1024 / 1024:.2f} MiB), no .env files.")
    return staging


def space_url(repo_id: str, runtime: Any) -> str:
    raw = getattr(runtime, "raw", {}) or {}
    for key in ("domain", "host", "url"):
        value = raw.get(key)
        if isinstance(value, str) and value.startswith("http"):
            return value.rstrip("/")
        if isinstance(value, str) and value:
            return f"https://{value}".rstrip("/")
    slug = repo_id.replace("/", "-").replace(".", "-").lower()
    return f"https://{slug}.hf.space"


def fetch(url: str, timeout: int = 30) -> tuple[int, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "frikhii-deploy/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read(4096).decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        return error.code, error.read(4096).decode("utf-8", "replace")
    except Exception as error:  # noqa: BLE001 - report deployment connection errors
        return 0, repr(error)


def wait_for_api(url: str, timeout: int) -> None:
    deadline = time.time() + timeout
    last = ""
    while time.time() < deadline:
        status, body = fetch(f"{url}/healthz")
        if status == 200:
            log(f"Core API is healthy at {url}/healthz")
            return
        last = f"{status} {body[:160]}"
        log(f"Waiting for API... ({last})")
        time.sleep(10)
    raise SystemExit(f"API did not become healthy in {timeout}s. Last response: {last}")


def update_frontend(api_url: str) -> None:
    log(f"Updating frontend runtime config -> {api_url}")
    text = CONFIG_JS.read_text(encoding="utf-8")
    text, count = re.subn(r'coreApiUrl:\s*"[^"]*"', f'coreApiUrl: "{api_url}"', text, count=1)
    if count != 1:
        raise SystemExit(f"Could not find coreApiUrl in {CONFIG_JS}")
    CONFIG_JS.write_text(text, encoding="utf-8")

    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        raise SystemExit("npm was not found in PATH.")
    log("Building GitHub Pages bundle...")
    subprocess.run([npm, "run", "build:pages"], cwd=ROOT / "apps" / "web", check=True)

    remote = subprocess.check_output(
        ["git", "remote", "get-url", "origin"], cwd=ROOT, text=True
    ).strip()
    deploy_dir = Path(tempfile.mkdtemp(prefix="frikhii-pages-"))
    log(f"Publishing dist to gh-pages via {remote}")
    for entry in (ROOT / "apps" / "web" / "dist").iterdir():
        target = deploy_dir / entry.name
        if entry.is_dir():
            shutil.copytree(entry, target)
        else:
            shutil.copy2(entry, target)

    def run_git(*args: str) -> None:
        subprocess.run(["git", *args], cwd=deploy_dir, check=True)

    run_git("init", "-q")
    run_git("add", "-A")
    run_git(
        "-c",
        "user.name=FRIKHII Deploy",
        "-c",
        "user.email=deploy@frikhii.local",
        "commit",
        "-q",
        "-m",
        "Deploy frontend with Hugging Face API URL",
    )
    run_git("push", "-f", remote, "HEAD:gh-pages")
    log("Frontend pushed to gh-pages. GitHub Pages will rebuild automatically.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--token-file", help="Path to a file containing a Hugging Face write token")
    parser.add_argument("--space-name", default=DEFAULT_SPACE_NAME, help="Space repository name")
    parser.add_argument("--provider", default="mock", choices=["mock", "gemini", "openai-compatible"])
    parser.add_argument("--timeout", type=int, default=900, help="Seconds to wait for the Space")
    parser.add_argument("--skip-frontend", action="store_true", help="Only deploy the backend")
    args = parser.parse_args()

    token = read_token(args)
    from huggingface_hub import HfApi  # imported late so --help works without the package

    api = HfApi(token=token)
    user = api.whoami(cache=False)
    username = user.get("name") or user.get("user")
    if not username:
        raise SystemExit("Could not read the Hugging Face username from the token.")
    repo_id = f"{username}/{args.space_name}"

    core = parse_env_file(CORE_ENV)
    ai = parse_env_file(AI_ENV)
    missing = [key for key in ("DATABASE_URL", "SUPABASE_URL", "INTERNAL_SERVICE_TOKEN") if not core.get(key)]
    if missing:
        raise SystemExit(f"Missing local Core API environment values: {', '.join(missing)}")
    if args.provider == "gemini" and not (ai.get("GEMINI_API_KEY") or ai.get("LLM_API_KEY")):
        raise SystemExit("AI_PROVIDER=gemini requires GEMINI_API_KEY in services/ai-engine/.env")

    cors_origins = core.get(
        "CORS_ORIGINS",
        "http://localhost:5173,https://copilot.frikhii.my.id",
    )
    secrets: dict[str, str] = {
        "DATABASE_URL": core["DATABASE_URL"],
        "SUPABASE_URL": core["SUPABASE_URL"],
        "INTERNAL_SERVICE_TOKEN": core["INTERNAL_SERVICE_TOKEN"],
        "CORS_ORIGINS": cors_origins,
        "APP_ENV": "development",
        "AI_PROVIDER": args.provider,
        "AI_ENGINE_URL": "http://127.0.0.1:8000",
        "RATE_LIMIT_PER_MINUTE": "120",
        "LOG_LEVEL": "info",
    }
    for key in ("SUPABASE_JWT_SECRET", "SUPABASE_JWT_AUD", "SUPABASE_JWT_ISSUER"):
        if core.get(key):
            secrets[key] = core[key]
    for key in (
        "GEMINI_API_KEY",
        "GEMINI_MODEL",
        "LLM_API_KEY",
        "LLM_MODEL",
        "LLM_BASE_URL",
    ):
        if ai.get(key):
            secrets[key] = ai[key]
    for key in (
        "AI_TIMEOUT_SECONDS",
        "AI_GENERATION_TIMEOUT_SECONDS",
        "GENERATION_STALE_SECONDS",
        "MAX_REQUEST_BYTES",
    ):
        if core.get(key):
            secrets[key] = core[key]

    log(f"Creating or reusing Space: {repo_id}")
    api.create_repo(
        repo_id=repo_id,
        repo_type="space",
        space_sdk="docker",
        exist_ok=True,
        private=False,
        token=token,
    )

    log(f"Setting {len(secrets)} Space secrets (values are never printed).")
    for key, value in secrets.items():
        api.add_space_secret(repo_id=repo_id, key=key, value=value, token=token)

    staging = build_staging()
    try:
        log("Uploading build context to Hugging Face...")
        api.upload_folder(
            repo_id=repo_id,
            repo_type="space",
            folder_path=str(staging),
            commit_message="Deploy FRIKHII Copilot backend",
            delete_patterns=["**/.env", "**/.env.*"],
            token=token,
        )
    finally:
        shutil.rmtree(staging, ignore_errors=True)

    log("Waiting for the Space to finish building...")
    deadline = time.time() + args.timeout
    runtime = None
    last_stage = ""
    while time.time() < deadline:
        runtime = api.get_space_runtime(repo_id=repo_id, token=token)
        stage = getattr(runtime.stage, "name", str(runtime.stage))
        if stage != last_stage:
            log(f"Space stage: {stage}")
            last_stage = stage
        if stage == "RUNNING":
            break
        if stage in {"BUILD_ERROR", "RUNTIME_ERROR", "STOPPED"}:
            raise SystemExit(f"Space failed with stage {stage}. Check the Space logs on Hugging Face.")
        time.sleep(10)
    else:
        raise SystemExit(f"Space did not become RUNNING within {args.timeout}s (last stage: {last_stage}).")

    url = space_url(repo_id, runtime)
    log(f"Space is running: {url}")
    wait_for_api(url, timeout=300)

    status, body = fetch(f"{url}/")
    log(f"Root check: HTTP {status} {body[:120]}")
    status, body = fetch(f"{url}/api/v1/health")
    log(f"API health check: HTTP {status} {body[:120]}")

    if not args.skip_frontend:
        update_frontend(url)
    else:
        log("Skipped frontend update. Set apps/web/public/config.js coreApiUrl to:")
        log(url)

    log("")
    log("Deployment complete.")
    log(f"Backend URL: {url}")
    log("Keep the Space public. The Core API still requires Supabase login for user data.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
