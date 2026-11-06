#!/usr/bin/env python
"""Push local service settings to a linked Railway service without printing secrets.

Usage:
    python scripts/set_railway_vars.py --service api

The script reads services/core-api/.env and services/ai-engine/.env, then runs
`railway variable set KEY --stdin` for each value. It prints only the key names.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE_ENV = ROOT / "services" / "core-api" / ".env"
AI_ENV = ROOT / "services" / "ai-engine" / ".env"


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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--service", default="api", help="Railway service name")
    args = parser.parse_args()

    core = parse_env_file(CORE_ENV)
    ai = parse_env_file(AI_ENV)
    missing = [key for key in ("DATABASE_URL", "SUPABASE_URL", "INTERNAL_SERVICE_TOKEN") if not core.get(key)]
    if missing:
        raise SystemExit(f"Missing local Core API environment values: {', '.join(missing)}")

    values: dict[str, str] = {
        "DATABASE_URL": core["DATABASE_URL"],
        "SUPABASE_URL": core["SUPABASE_URL"],
        "INTERNAL_SERVICE_TOKEN": core["INTERNAL_SERVICE_TOKEN"],
        "CORS_ORIGINS": core.get(
            "CORS_ORIGINS",
            "http://localhost:5173,https://copilot.frikhii.my.id",
        ),
        "APP_ENV": "development",
        "AI_PROVIDER": "mock",
        "AI_ENGINE_URL": "http://127.0.0.1:8000",
        "RATE_LIMIT_PER_MINUTE": "120",
        "LOG_LEVEL": "info",
    }
    for key in (
        "SUPABASE_JWT_SECRET",
        "SUPABASE_JWT_AUD",
        "SUPABASE_JWT_ISSUER",
        "SUPABASE_JWKS_URL",
        "AI_TIMEOUT_SECONDS",
        "AI_GENERATION_TIMEOUT_SECONDS",
        "GENERATION_STALE_SECONDS",
        "MAX_REQUEST_BYTES",
    ):
        if core.get(key):
            values[key] = core[key]
    for key in (
        "GEMINI_API_KEY",
        "GEMINI_MODEL",
        "LLM_API_KEY",
        "LLM_MODEL",
        "LLM_BASE_URL",
        "AI_MAX_OUTPUT_TOKENS",
        "AI_TEMPERATURE",
        "AI_REQUEST_TIMEOUT",
        "AI_MAX_RETRIES",
    ):
        if ai.get(key):
            values[key] = ai[key]

    print(f"Setting {len(values)} variables on Railway service '{args.service}':")
    print(", ".join(sorted(values)))
    for key, value in values.items():
        command = [
            "cmd",
            "/c",
            "railway",
            "variable",
            "set",
            key,
            "--stdin",
            "--service",
            args.service,
            "--skip-deploys",
            "--json",
        ]
        result = subprocess.run(
            command,
            cwd=ROOT,
            input=value,
            text=True,
            capture_output=True,
        )
        if result.returncode != 0:
            print(f"Failed to set {key}: {result.stderr.strip()}", file=sys.stderr)
            return result.returncode
        print(f"  set {key}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
