#!/usr/bin/env python3
"""Fix production admin: remove invalid emails, ensure ADMIN_BOOTSTRAP_* account exists."""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import app.models  # noqa: F401
from app.bootstrap import bootstrap_admin
from app.config import get_settings
from app.database import SessionLocal
from app.models.user import User, UserRole

settings = get_settings()


def main() -> None:
    db = SessionLocal()
    try:
        bootstrap_admin(db)
        admins = db.query(User).filter(User.role == UserRole.admin).all()
        print(f"Admin accounts ({len(admins)}):")
        for u in admins:
            print(f"  - {u.email} (active={u.is_active})")
        print()
        print(f"Bootstrap login (if newly created): {settings.admin_bootstrap_email}")
        print(f"Password from ADMIN_BOOTSTRAP_PASSWORD env (default changeme123 in dev)")
        print("Imported WP admin: pj@redbear.tv / ChangeMeOnFirstLogin!")
    finally:
        db.close()


if __name__ == "__main__":
    main()
