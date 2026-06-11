#!/usr/bin/env python3
"""Import any posts from posts.json that are not yet in DATABASE_URL."""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.database import SessionLocal, engine
from app.db_migrate import run_migrations
from app.models import Base  # noqa: F401
from app.models.blog import Post
from app.seed_import import import_blog_if_empty


def main() -> None:
    print(f"Target: {engine.url.render_as_string(hide_password=True)}")
    run_migrations(engine)
    db = SessionLocal()
    try:
        before = db.query(Post).count()
        added = import_blog_if_empty(db)
        after = db.query(Post).count()
        print(f"Posts: {before} → {after} ({added} imported from JSON)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
