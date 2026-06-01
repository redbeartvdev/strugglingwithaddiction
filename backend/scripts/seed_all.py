#!/usr/bin/env python3
"""CLI: import schema + bootstrap + blog JSON into DATABASE_URL."""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.bootstrap import bootstrap_admin, bootstrap_plans, seed_rehab_centers
from app.database import SessionLocal, engine
from app.db_migrate import run_migrations
from app.models import Base  # noqa: F401 — register all ORM models
from app.models.blog import Post
from app.models.rehab import RehabCenter
from app.seed_import import import_blog_if_empty


def main() -> None:
    print(f"Target: {engine.url.render_as_string(hide_password=True)}")
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    db = SessionLocal()
    try:
        bootstrap_admin(db)
        bootstrap_plans(db)
        seed_rehab_centers(db)
        print(f"Rehab centers: {db.query(RehabCenter).count()}")
        import_blog_if_empty(db)
        print(f"Posts in database: {db.query(Post).count()}")
    finally:
        db.close()
    print("Done.")


if __name__ == "__main__":
    main()
