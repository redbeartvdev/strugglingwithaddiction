#!/usr/bin/env python3
"""Clear email logs, finance invoice mirrors, and analytics events."""
from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.database import engine
from app.db_migrate import wipe_email_finance_analytics_once


def main() -> None:
    force = os.getenv("WIPE_OPS_DATA_FORCE", "").strip().lower() in {"1", "true", "yes"}
    print(f"Target: {engine.url.render_as_string(hide_password=True)}")
    counts = wipe_email_finance_analytics_once(engine, force=force)
    if counts.get("skipped"):
        print("Already applied — no rows deleted.")
        return
    for table, n in counts.items():
        print(f"{table}: deleted {n}")
    print("Done.")


if __name__ == "__main__":
    main()
