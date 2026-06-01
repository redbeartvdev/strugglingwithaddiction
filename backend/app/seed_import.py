"""Import blog JSON into Postgres when the database is empty."""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.blog import Author, Category, Post, PostStatus

logger = logging.getLogger("swa")

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = Path(__file__).resolve().parents[1]


def resolve_data_dir() -> Path | None:
    candidates: list[Path] = []
    if os.getenv("SEED_DATA_DIR"):
        candidates.append(Path(os.environ["SEED_DATA_DIR"]))
    candidates.extend(
        [
            Path("/app/seed-data"),
            BACKEND_ROOT / "seed-data",
            REPO_ROOT / "src" / "data",
        ]
    )
    for path in candidates:
        if (path / "posts.json").is_file():
            return path
    return None


def import_blog_if_empty(db: Session) -> int:
    if db.query(Post).count() > 0:
        logger.info("Blog posts already in database — skipping JSON import")
        return 0

    data_dir = resolve_data_dir()
    if not data_dir:
        logger.warning("No posts.json found (checked /app/seed-data and src/data)")
        return 0

    logger.info("Importing blog data from %s", data_dir)
    return _import_blog_from_dir(db, data_dir)


def _import_blog_from_dir(db: Session, data_dir: Path) -> int:
    categories_path = data_dir / "categories.json"
    authors_path = data_dir / "authors.json"
    posts_path = data_dir / "posts.json"

    if categories_path.is_file():
        for c in json.loads(categories_path.read_text(encoding="utf-8")):
            if not db.query(Category).filter(Category.id == c["id"]).first():
                db.add(Category(id=c["id"], name=c["name"], slug=c["slug"]))
        db.commit()

    if authors_path.is_file():
        for a in json.loads(authors_path.read_text(encoding="utf-8")):
            if not db.query(Author).filter(Author.id == a["id"]).first():
                db.add(
                    Author(
                        id=a["id"],
                        slug=a["slug"],
                        name=a["name"],
                        title=a.get("title"),
                        bio=a.get("bio"),
                    )
                )
        db.commit()

    if not posts_path.is_file():
        logger.warning("posts.json missing in %s", data_dir)
        return 0

    posts = json.loads(posts_path.read_text(encoding="utf-8"))
    cat_map = {c.id: c for c in db.query(Category).all()}
    added = 0
    for p in posts:
        if db.query(Post).filter(Post.legacy_wp_id == p["id"]).first():
            continue
        post = Post(
            legacy_wp_id=p["id"],
            slug=p["slug"],
            title=p.get("title", ""),
            excerpt=p.get("excerpt", ""),
            content_html=p.get("content", ""),
            featured_image_key=p.get("featuredImage"),
            status=PostStatus.published,
            author_id=p.get("authorId"),
            published_at=datetime.fromisoformat(p["date"])
            if p.get("date")
            else datetime.now(timezone.utc),
        )
        db.add(post)
        db.flush()
        for cid in p.get("categories") or []:
            if cid in cat_map:
                post.categories.append(cat_map[cid])
        for cn in p.get("categoryNames") or []:
            cat = db.query(Category).filter(Category.id == cn["id"]).first()
            if cat and cat not in post.categories:
                post.categories.append(cat)
        added += 1
    db.commit()
    logger.info("Imported %s blog posts (%s total)", added, db.query(Post).count())
    return added
