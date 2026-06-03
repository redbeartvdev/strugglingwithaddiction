from datetime import datetime, timezone
from typing import Annotated
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.blog import Post, PostStatus
from app.models.directory_page import DirectoryPage, DirectoryPageStatus
from app.models.rehab import ListingStatus, RehabCenter

router = APIRouter(tags=["seo"])
settings = get_settings()


def _site_base() -> str:
    if settings.public_site_url:
        return settings.public_site_url.rstrip("/")
    origins = settings.cors_origin_list
    if origins:
        return origins[0].rstrip("/")
    return "https://strugglingwithaddiction.com"


@router.get("/robots.txt", include_in_schema=False)
def robots_txt():
    base = _site_base()
    body = f"""User-agent: *
Allow: /

Sitemap: {base}/sitemap.xml
"""
    return Response(content=body, media_type="text/plain")


@router.get("/sitemap.xml", include_in_schema=False)
def sitemap_xml(db: Annotated[Session, Depends(get_db)]):
    base = _site_base()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    urls: list[tuple[str, str]] = [
        (f"{base}/", now),
        (f"{base}/about", now),
        (f"{base}/blog", now),
        (f"{base}/rehab-centers", now),
        (f"{base}/advertise", now),
        (f"{base}/privacy", now),
        (f"{base}/terms", now),
        (f"{base}/advertising-policy", now),
        (f"{base}/editorial-policy", now),
    ]

    posts = db.query(Post).filter(Post.status == PostStatus.published, Post.deleted_at.is_(None)).all()
    for post in posts:
        urls.append((f"{base}/blog/{post.slug}", now))

    centers = (
        db.query(RehabCenter)
        .filter(RehabCenter.listing_status == ListingStatus.published, RehabCenter.deleted_at.is_(None))
        .all()
    )
    for center in centers:
        urls.append((f"{base}/rehab-centers/{center.slug}", now))

    pages = (
        db.query(DirectoryPage)
        .filter(DirectoryPage.status == DirectoryPageStatus.published, DirectoryPage.deleted_at.is_(None))
        .all()
    )
    for page in pages:
        if page.city_slug:
            loc = f"{base}/rehab-centers/location/{page.state_slug}/{page.city_slug}"
        else:
            loc = f"{base}/rehab-centers/location/{page.state_slug}"
        urls.append((loc, now))

    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc, lastmod in urls:
        parts.append("  <url>")
        parts.append(f"    <loc>{escape(loc)}</loc>")
        parts.append(f"    <lastmod>{lastmod}</lastmod>")
        parts.append("  </url>")
    parts.append("</urlset>")
    return Response(content="\n".join(parts), media_type="application/xml")
