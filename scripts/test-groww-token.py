#!/usr/bin/env python3
"""Temporary script: verify Groww credentials via official Python SDK (no full secrets printed)."""

from __future__ import annotations

import importlib.metadata
import os
import sys
from pathlib import Path


def _growwapi_version(growwapi_mod: object) -> str:
    try:
        return importlib.metadata.version("growwapi")
    except importlib.metadata.PackageNotFoundError:
        return getattr(growwapi_mod, "__version__", "unknown")


def _tf(value: bool) -> str:
    return "true" if value else "false"


def main() -> int:
    try:
        from dotenv import load_dotenv
    except ImportError:
        print(
            "Missing package 'python-dotenv'. Install it with:\n"
            "  pip install python-dotenv",
            file=sys.stderr,
        )
        return 1

    project_root = Path(__file__).resolve().parent.parent
    cwd_before = os.getcwd()
    try:
        os.chdir(project_root)
        load_dotenv(".env.local")
    finally:
        os.chdir(cwd_before)

    try:
        import growwapi
        from growwapi import GrowwAPI
    except ImportError:
        print(
            "Missing package 'growwapi'. Install it with:\n"
            "  pip install growwapi\n"
            "If you use a virtual environment:\n"
            "  python -m venv .venv\n"
            "  .venv\\Scripts\\activate          (Windows PowerShell/CMD)\n"
            "  source .venv/bin/activate        (macOS/Linux)\n"
            "  pip install growwapi",
            file=sys.stderr,
        )
        return 1

    print(f"growwapi package version: {_growwapi_version(growwapi)}")
    print(f"growwapi package path: {getattr(growwapi, '__file__', '(unknown)')}")
    print(f"GrowwAPI.__module__: {GrowwAPI.__module__}")

    raw_key = os.environ.get("GROWW_API_KEY", "")
    raw_secret = os.environ.get("GROWW_API_SECRET", "")
    api_key = raw_key.strip()
    api_secret = raw_secret.strip()

    print(f"API key exists: {_tf(bool(api_key))}")
    print(f"API secret exists: {_tf(bool(api_secret))}")
    print(f"API key length: {len(api_key)}")
    print(f"API secret length: {len(api_secret)}")
    print(f"API key starts with (first 4): {api_key[:4]}")
    print(f"API secret starts with (first 2): {api_secret[:2]}")

    if not api_key or not api_secret:
        print(
            "Set GROWW_API_KEY and GROWW_API_SECRET in .env.local at the project root, "
            "or in the environment, then run again.",
            file=sys.stderr,
        )
        return 1

    try:
        GrowwAPI.get_access_token(api_key=api_key, secret=api_secret)
    except Exception as exc:
        print(f"Exception class: {type(exc).__name__}", file=sys.stderr)
        print(f"Exception message: {exc}", file=sys.stderr)
        return 1

    print("Access token generated successfully")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
