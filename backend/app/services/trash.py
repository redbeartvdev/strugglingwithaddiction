from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.blog import Post
from app.models.blog_settings import BlogSettings


def get_blog_settings(db: Session) -> BlogSettings:
    row = db.query(BlogSettings).filter(BlogSettings.id == 1).first()
    if not row:
        row = BlogSettings(id=1, trash_retention_months=6)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def purge_expired_trash(db: Session) -> int:
    settings = get_blog_settings(db)
    months = settings.trash_retention_months
    if months not in (1, 6, 12):
        months = 6
    cutoff = datetime.now(timezone.utc) - timedelta(days=months * 30)
    q = db.query(Post).filter(Post.deleted_at.isnot(None), Post.deleted_at < cutoff)
    count = q.count()
    for post in q.all():
        db.delete(post)
    if count:
        db.commit()
    return count
