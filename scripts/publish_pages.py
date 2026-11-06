#!/usr/bin/env python
"""Build the static frontend and publish it to the gh-pages branch.

Usage:
    python scripts/publish_pages.py
    python scripts/publish_pages.py --api-url https://api.example.com

The script updates apps/web/public/config.js only when --api-url is provided,
runs the GitHub Pages build, and force-pushes the dist folder to gh-pages.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_JS = ROOT / "apps" / "web" / "public" / "config.js"
DIST = ROOT / "apps" / "web" / "dist"


def update_api_url(api_url: str) -> None:
    text = CONFIG_JS.read_text(encoding="utf-8")
    text, count = re.subn(r'coreApiUrl:\s*"[^"]*"', f'coreApiUrl: "{api_url}"', text, count=1)
    if count != 1:
        raise SystemExit(f"Could not find coreApiUrl in {CONFIG_JS}")
    CONFIG_JS.write_text(text, encoding="utf-8")
    print(f"Updated runtime API URL to {api_url}")


def run_build() -> None:
    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        raise SystemExit("npm was not found in PATH.")
    command = ["cmd", "/c", npm, "run", "build:pages"] if os.name == "nt" else [npm, "run", "build:pages"]
    subprocess.run(command, cwd=ROOT / "apps" / "web", check=True)
    if not (DIST / "index.html").exists():
        raise SystemExit("Build finished without dist/index.html")
    if not (DIST / "404.html").exists():
        raise SystemExit("Build finished without dist/404.html")


def publish() -> None:
    remote = subprocess.check_output(
        ["git", "remote", "get-url", "origin"], cwd=ROOT, text=True
    ).strip()
    deploy_dir = Path(tempfile.mkdtemp(prefix="frikhii-pages-"))
    print(f"Publishing {DIST} to gh-pages via {remote}")
    for entry in DIST.iterdir():
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
        "Deploy frontend",
    )
    run_git("push", "-f", remote, "HEAD:gh-pages")
    print("Pushed to gh-pages. GitHub Pages will rebuild automatically.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", help="Write this Core API URL into config.js before building")
    args = parser.parse_args()

    if args.api_url:
        update_api_url(args.api_url)
    run_build()
    publish()
    return 0


if __name__ == "__main__":
    sys.exit(main())
