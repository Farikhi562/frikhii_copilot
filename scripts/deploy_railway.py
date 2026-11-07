#!/usr/bin/env python
r"""Deploy the FRIKHII Copilot backend to Railway.

The script uses the Railway CLI (must be installed and authenticated) to
create/update a project and deploy from the local repo. It then updates
apps/web/public/config.js with the new backend URL and pushes the frontend
to the gh-pages branch.

Prerequisites:
  1. Install Railway CLI: https://docs.railway.app/guides/cli
  2. Authenticate: railway login
  3. Fill in services/core-api/.env and services/ai-engine/.env

Usage:
    python scripts/deploy_railway.py
    python scripts/deploy_railway.py --skip-frontend
    python scripts/deploy_railway.py --project-id <existing-id>

The script reads Railway project/service IDs from .railway-state.json (auto-
created on first run). Environment variables are set via the Railway CLI so
secrets never appear in shell history.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CORE_ENV = ROOT / "services" / "core-api" / ".env"
AI_ENV = ROOT / "services" / "ai-engine" / ".env"
CONFIG_JS = ROOT / "apps" / "web" / "public" / "config.js"
STATE_FILE = ROOT / ".railway-state.json"
RAILWAY_TOML = ROOT / "deploy" / "railway" / "railway.toml"

PROJECT_NAME = "frikhii-copilot"
SERVICE_NAME = "frikhii-core"


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
        value = value.strip().strip("\"'")
        if key:
            values[key] = value
    return values


def railway(*args: str, capture: bool = False, check: bool = True) -> subprocess.CompletedProcess[str]:
    cmd = ["railway", *args]
    if capture:
        result = subprocess.run(cmd, capture_output=True, text=True, check=check, cwd=str(ROOT))
    else:
        result = subprocess.run(cmd, text=True, check=check, cwd=str(ROOT))
    return result


def railway_output(*args: str) -> str:
    result = railway(*args, capture=True)
    return result.stdout.strip()


def load_state() -> dict[str, str]:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_state(state: dict[str, str]) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")


def check_railway_cli() -> None:
    if not shutil.which("railway"):
        raise SystemExit(
            "Railway CLI not found. Install it from https://docs.railway.app/guides/cli\n"
            "  npm install -g @railway/cli   (or via the install script on the docs page)\n"
            "Then run: railway login"
        )
    result = subprocess.run(["railway", "whoami"], capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(
            "Not authenticated with Railway. Run: railway login\n"
            "Then re-run this script."
        )
    log(f"Railway CLI authenticated: {result.stdout.strip()}")


def ensure_project(state: dict[str, str], project_id: str | None) -> str:
    if project_id:
        state["project_id"] = project_id
        save_state(state)
        return project_id
    if "project_id" in state:
        log(f"Reusing existing Railway project: {state['project_id']}")
        return state["project_id"]
    log(f"Creating Railway project: {PROJECT_NAME}")
    result = railway("project", "create", "--name", PROJECT_NAME, capture=True)
    # Railway CLI prints the project URL or ID — parse the ID from the output
    output = result.stdout + result.stderr
    match = re.search(r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})", output, re.IGNORECASE)
    if not match:
        raise SystemExit(f"Could not parse project ID from Railway output:\n{output}")
    pid = match.group(1)
    state["project_id"] = pid
    save_state(state)
    log(f"Project created: {pid}")
    return pid


def set_env_vars(core: dict[str, str], ai: dict[str, str]) -> None:
    cors_origins = core.get(
        "CORS_ORIGINS",
        "http://localhost:5173,https://copilot.frikhii.my.id",
    )
    env_vars: dict[str, str] = {
        "DATABASE_URL": core["DATABASE_URL"],
        "SUPABASE_URL": core["SUPABASE_URL"],
        "INTERNAL_SERVICE_TOKEN": core["INTERNAL_SERVICE_TOKEN"],
        "CORS_ORIGINS": cors_origins,
        "APP_ENV": "production",
        "AI_PROVIDER": "gemini",
        "AI_ENGINE_URL": "http://127.0.0.1:8000",
        "RATE_LIMIT_PER_MINUTE": "120",
        "LOG_LEVEL": "info",
    }
    for key in ("SUPABASE_JWT_SECRET", "SUPABASE_JWT_AUD", "SUPABASE_JWT_ISSUER",
                "AI_TIMEOUT_SECONDS", "AI_GENERATION_TIMEOUT_SECONDS",
                "GENERATION_STALE_SECONDS", "MAX_REQUEST_BYTES"):
        if core.get(key):
            env_vars[key] = core[key]
    for key in ("GEMINI_API_KEY", "GEMINI_MODEL", "LLM_API_KEY",
                "LLM_MODEL", "LLM_BASE_URL"):
        if ai.get(key):
            env_vars[key] = ai[key]

    log(f"Setting {len(env_vars)} Railway environment variables (values not printed)...")
    # Build a single railway variables set call with all key=value pairs
    var_args = [f"{k}={v}" for k, v in env_vars.items()]
    railway("variables", "set", *var_args)
    log("Environment variables set.")


def deploy() -> None:
    log("Deploying to Railway (this builds the Docker image and starts the service)...")
    # Use --detach so the CLI returns immediately; we poll for health ourselves
    railway("up", "--detach", "--dockerfile", "deploy/railway/Dockerfile", "--service", SERVICE_NAME)
    log("Deployment triggered.")


def get_service_url(state: dict[str, str]) -> str:
    if "service_url" in state:
        return state["service_url"]
    log("Fetching service domain from Railway...")
    # railway domain returns the public URL
    try:
        output = railway_output("domain")
        if output and not output.startswith("No"):
            url = output if output.startswith("http") else f"https://{output}"
            state["service_url"] = url.rstrip("/")
            save_state(state)
            return state["service_url"]
    except subprocess.CalledProcessError:
        pass
    raise SystemExit(
        "Could not read service URL from Railway. "
        "Open the Railway dashboard, copy the public domain, and run:\n"
        f"  python scripts/deploy_railway.py --service-url https://your-domain.up.railway.app"
    )


def fetch(url: str, timeout: int = 30) -> tuple[int, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "frikhii-deploy/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read(4096).decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        return error.code, error.read(4096).decode("utf-8", "replace")
    except Exception as error:
        return 0, repr(error)


def wait_for_api(url: str, timeout: int = 600) -> None:
    log(f"Waiting for API to become healthy at {url}/healthz ...")
    deadline = time.time() + timeout
    last = ""
    while time.time() < deadline:
        status, body = fetch(f"{url}/healthz")
        if status == 200:
            log(f"API is healthy at {url}/healthz")
            return
        last = f"{status} {body[:160]}"
        log(f"  Not ready yet ({last}), retrying in 15 s...")
        time.sleep(15)
    raise SystemExit(f"API did not become healthy within {timeout}s. Last response: {last}")


def update_frontend(api_url: str) -> None:
    log(f"Updating frontend runtime config -> {api_url}")
    text = CONFIG_JS.read_text(encoding="utf-8")
    text, count = re.subn(r'coreApiUrl:\s*"[^"]*"', f'coreApiUrl: "{api_url}"', text, count=1)
    if count != 1:
        raise SystemExit(f"Could not find coreApiUrl in {CONFIG_JS}")
    CONFIG_JS.write_text(text, encoding="utf-8")

    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        raise SystemExit("npm not found in PATH.")
    log("Building GitHub Pages bundle...")
    build_cmd = ["cmd", "/c", npm, "run", "build:pages"] if os.name == "nt" else [npm, "run", "build:pages"]
    subprocess.run(build_cmd, cwd=str(ROOT / "apps" / "web"), check=True)

    remote = subprocess.check_output(
        ["git", "remote", "get-url", "origin"], cwd=str(ROOT), text=True
    ).strip()
    import tempfile
    deploy_dir = Path(tempfile.mkdtemp(prefix="frikhii-pages-"))
    log(f"Pushing dist/ to gh-pages via {remote}...")
    for entry in (ROOT / "apps" / "web" / "dist").iterdir():
        target = deploy_dir / entry.name
        if entry.is_dir():
            shutil.copytree(entry, target)
        else:
            shutil.copy2(entry, target)

    def run_git(*args: str) -> None:
        subprocess.run(["git", *args], cwd=str(deploy_dir), check=True)

    run_git("init", "-q")
    run_git("add", "-A")
    run_git("-c", "user.name=FRIKHII Deploy", "-c", "user.email=deploy@frikhii.local",
            "commit", "-q", "-m", "Deploy frontend with Railway API URL")
    run_git("push", "-f", remote, "HEAD:gh-pages")
    log("Frontend pushed to gh-pages.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-id", help="Existing Railway project ID (skips creation)")
    parser.add_argument("--service-url", help="Override the service URL (skip auto-detect)")
    parser.add_argument("--skip-frontend", action="store_true", help="Skip frontend rebuild + gh-pages push")
    parser.add_argument("--skip-deploy", action="store_true", help="Only set env vars, do not trigger a new deploy")
    args = parser.parse_args()

    check_railway_cli()

    core = parse_env_file(CORE_ENV)
    ai = parse_env_file(AI_ENV)
    missing = [k for k in ("DATABASE_URL", "SUPABASE_URL", "INTERNAL_SERVICE_TOKEN") if not core.get(k)]
    if missing:
        raise SystemExit(f"Missing Core API env values: {', '.join(missing)}\nCheck {CORE_ENV}")
    if not (ai.get("GEMINI_API_KEY") or ai.get("LLM_API_KEY")):
        raise SystemExit(f"GEMINI_API_KEY missing in {AI_ENV}")

    state = load_state()
    pid = ensure_project(state, args.project_id)
    log(f"Using Railway project: {pid}")

    # Link local directory to the Railway project so subsequent CLI calls work
    railway("link", "--project", pid, "--service", SERVICE_NAME, check=False)

    set_env_vars(core, ai)

    if not args.skip_deploy:
        deploy()

    service_url = args.service_url or get_service_url(state)
    log(f"Service URL: {service_url}")

    wait_for_api(service_url)

    status, body = fetch(f"{service_url}/api/v1/health")
    log(f"Health check: HTTP {status} {body[:120]}")

    if not args.skip_frontend:
        update_frontend(service_url)
    else:
        log(f"Skipped frontend update. Set coreApiUrl in apps/web/public/config.js to:\n  {service_url}")

    log("")
    log("Deployment complete.")
    log(f"Backend: {service_url}")
    log("Frontend: https://farikhi562.github.io/frikhii_copilot/ (after Pages rebuild)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
