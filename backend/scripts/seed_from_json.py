#!/usr/bin/env python3
"""Seed blog data from frontend JSON files."""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.models  # noqa: F401 — register all ORM models
from app.database import SessionLocal
from app.models.blog import Author, Category, Post, PostStatus, post_categories
from app.models.user import User

DATA = ROOT / "src" / "data"


def main():
    db = SessionLocal()
    try:
        categories_path = DATA / "categories.json"
        authors_path = DATA / "authors.json"
        posts_path = DATA / "posts.json"

        if categories_path.exists():
            for c in json.loads(categories_path.read_text()):
                if not db.query(Category).filter(Category.id == c["id"]).first():
                    db.add(Category(id=c["id"], name=c["name"], slug=c["slug"]))
            db.commit()

        if authors_path.exists():
            for a in json.loads(authors_path.read_text()):
                if not db.query(Author).filter(Author.id == a["id"]).first():
                    db.add(Author(id=a["id"], slug=a["slug"], name=a["name"], title=a.get("title"), bio=a.get("bio")))
            db.commit()

        if not posts_path.exists():
            print("posts.json not found — run: node scripts/extract-posts.mjs")
            return

        posts = json.loads(posts_path.read_text())
        cat_map = {c.id: c for c in db.query(Category).all()}
        for p in posts:
            if db.query(Post).filter(Post.legacy_wp_id == p["id"]).first():
                continue
            status = PostStatus.published
            post = Post(
                legacy_wp_id=p["id"],
                slug=p["slug"],
                title=p.get("title", ""),
                excerpt=p.get("excerpt", ""),
                content_html=p.get("content", ""),
                featured_image_key=p.get("featuredImage"),
                status=status,
                author_id=p.get("authorId"),
                published_at=datetime.fromisoformat(p["date"]) if p.get("date") else datetime.now(timezone.utc),
                meta_title=p.get("metaTitle") or None,
                meta_description=p.get("metaDescription") or None,
            )
            db.add(post)
            db.flush()
            cat_ids = p.get("categories") or []
            for cid in cat_ids:
                if cid in cat_map:
                    post.categories.append(cat_map[cid])
            for cn in p.get("categoryNames") or []:
                cat = db.query(Category).filter(Category.id == cn["id"]).first()
                if cat and cat not in post.categories:
                    post.categories.append(cat)
        db.commit()
        print(f"Seeded {len(posts)} posts")
    finally:
        db.close()


if __name__ == "__main__":
    main()
