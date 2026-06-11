"""Import blog JSON into Postgres when the database is empty."""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import hash_password
from app.models.blog import Author, Category, Post, PostStatus
from app.models.profile import UserProfile
from app.models.user import User, UserRole

settings = get_settings()

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
    """Seed blog from JSON on first run; on later runs, import any posts missing from the DB."""
    data_dir = resolve_data_dir()
    if not data_dir:
        logger.warning("No posts.json found (checked /app/seed-data and src/data)")
        return 0

    existing = db.query(Post).count()
    if existing > 0:
        logger.info("Blog posts in database (%s) — syncing missing entries from %s", existing, data_dir)
    else:
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
            meta_title=p.get("metaTitle") or None,
            meta_description=p.get("metaDescription") or None,
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


def import_users_from_dir(db: Session, data_dir: Path) -> int:
    """Create User + UserProfile rows from users.json and link matching Author records."""
    users_path = data_dir / "users.json"
    if not users_path.is_file():
        logger.info("No users.json in %s — skipping user import", data_dir)
        return 0

    records = json.loads(users_path.read_text(encoding="utf-8"))
    password = settings.import_users_default_password
    added = 0

    for row in records:
        email = row["email"].strip().lower()
        if db.query(User).filter(User.email == email).first():
            continue

        role_name = row.get("role", "editor")
        try:
            role = UserRole(role_name)
        except ValueError:
            role = UserRole.editor

        user = User(
            email=email,
            password_hash=hash_password(password),
            role=role,
            is_active=bool(row.get("is_active", True)),
            email_verified_at=datetime.now(timezone.utc) if row.get("is_active", True) else None,
        )
        db.add(user)
        db.flush()

        slug = row.get("slug") or email.split("@")[0]
        display = row.get("name") or slug.replace("-", " ").title()
        db.add(
            UserProfile(
                user_id=user.id,
                display_name=display,
                slug=slug,
                title=row.get("title"),
                bio=row.get("bio"),
            )
        )

        author = None
        legacy_id = row.get("id")
        if legacy_id is not None:
            author = db.query(Author).filter(Author.id == legacy_id).first()
        if not author and slug:
            author = db.query(Author).filter(Author.slug == slug).first()
        if author and author.user_id is None:
            author.user_id = user.id

        added += 1

    if added:
        db.commit()
    logger.info("Imported %s users (%s total)", added, db.query(User).count())
    return added


def import_users_if_missing(db: Session) -> int:
    """Import users.json when no editor/admin accounts exist beyond bootstrap."""
    data_dir = resolve_data_dir()
    if not data_dir:
        return 0

    users_path = data_dir / "users.json"
    if not users_path.is_file():
        return 0

    staff_roles = (UserRole.admin, UserRole.editor)
    staff_count = db.query(User).filter(User.role.in_(staff_roles)).count()
    if staff_count > 1:
        logger.info("Staff users already present — skipping users.json import")
        return 0

    logger.info("Importing users from %s", data_dir)
    return import_users_from_dir(db, data_dir)
