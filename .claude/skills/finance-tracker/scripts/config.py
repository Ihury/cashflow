"""Loader for personal config files under data/config/."""
from __future__ import annotations

import json
import sys
from functools import lru_cache
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[4]
_CONFIG_DIR = _REPO_ROOT / "data" / "config"


@lru_cache(maxsize=None)
def load_config(name: str) -> dict:
    """Load data/config/{name}.local.json, fallback to .sample.json with a warning."""
    local = _CONFIG_DIR / f"{name}.local.json"
    sample = _CONFIG_DIR / f"{name}.sample.json"
    if local.exists():
        with local.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    if sample.exists():
        print(
            f"[config] {name}.local.json not found — falling back to {name}.sample.json",
            file=sys.stderr,
        )
        with sample.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    raise FileNotFoundError(
        f"Neither {local} nor {sample} exists. Run init or create one from the sample."
    )
