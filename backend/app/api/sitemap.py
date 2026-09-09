"""Public sitemap + robots.txt for Google Search Console.

URLs use the apex canonical host. Only indexable public pages are included.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Annotated
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.billing import Subscription
from app.models.blog import Author, Post, PostStatus
from app.models.client_portal import ClientLandingPage
from app.models.insurance import InsuranceCatalog
from app.models.profile import UserProfile
from app.models.rehab import ListingStatus, RehabCenter
from app.services.storage import resolve_image_url

router = APIRouter(tags=["seo"])
settings = get_settings()

CANONICAL_HOST = "strugglingwithaddiction.com"
WWW_HOST = f"www.{CANONICAL_HOST}"
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
IMAGE_NS = "http://www.google.com/schemas/sitemap-image/1.1"
_CACHE_HEADERS = {"Cache-Control": "public, max-age=3600"}

# Keep in sync with src/data/insuranceGuides.js
INSURANCE_GUIDE_SLUGS = (
    "aca-parity",
    "reading-an-eob",
    "prior-authorization",
    "single-case-agreements",
    "calling-your-payer",
)

STATIC_PAGES = (
    "/",
    "/about",
    "/blog",
    "/rehab-centers",
    "/insurance-coverage",
    "/videos",
    "/portal",
    "/privacy",
    "/terms",
    "/accessibility",
)


def canonical_base_url() -> str:
    raw = (settings.public_site_url or "").strip().rstrip("/")
    if settings.is_production or CANONICAL_HOST in raw:
        return f"https://{CANONICAL_HOST}"
    return raw or f"https://{CANONICAL_HOST}"


def _xml_escape(value: str) -> str:
    return escape(value, {'"': "&quot;", "'": "&apos;"})


def _w3c_date(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).date().isoformat()


def _latest(*values: datetime | None) -> datetime | None:
    dated = [item for item in values if item is not None]
    return max(dated) if dated else None


def _abs_url(path: str) -> str:
    if path.startswith("http://") or path.startswith("https://"):
        return path
    base = canonical_base_url()
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{base}{path}"


def _slugify_segment(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(value or "").lower().strip()).strip("-")


def _center_landing_path(center: RehabCenter) -> str | None:
    state = center.state or (center.location_display or "").split(",")[-1].strip()
    city = center.city or (center.location_display or "").split(",")[0].strip()
    if not state or not city or not center.name:
        return None
    return (
        f"/rehabs/united-states/{_slugify_segment(state)}/"
        f"{_slugify_segment(city)}/{_slugify_segment(center.name)}"
    )


def _xml_response(body: str) -> Response:
    return Response(
        content=body,
        media_type="application/xml; charset=utf-8",
        headers=_CACHE_HEADERS,
    )


def _url_entry(loc: str, lastmod: datetime | None = None, image: str | None = None) -> str:
    parts = [f"  <url>\n    <loc>{_xml_escape(loc)}</loc>"]
    stamped = _w3c_date(lastmod)
    if stamped:
        parts.append(f"    <lastmod>{stamped}</lastmod>")
    if image:
        parts.append(
            "    <image:image>\n"
            f"      <image:loc>{_xml_escape(image)}</image:loc>\n"
            "    </image:image>"
        )
    parts.append("  </url>")
    return "\n".join(parts)


def _urlset(entries: list[str], with_images: bool = False) -> str:
    extra = f' xmlns:image="{IMAGE_NS}"' if with_images else ""
    inner = "\n".join(entries)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<urlset xmlns="{SITEMAP_NS}"{extra}>\n'
        f"{inner}\n"
        "</urlset>\n"
    )


def _active_owner_ids(db: Session) -> set[int]:
    rows = (
        db.query(Subscription.user_id)
        .filter(Subscription.status.in_(("active", "trialing", "past_due")))
        .all()
    )
    return {row[0] for row in rows if row[0] is not None}


def _indexable_centers(db: Session) -> list[RehabCenter]:
    owners = _active_owner_ids(db)
    centers = (
        db.query(RehabCenter)
        .filter(
            RehabCenter.listing_status == ListingStatus.published,
            RehabCenter.deleted_at.is_(None),
        )
        .all()
    )
    out: list[RehabCenter] = []
    for center in centers:
        public = bool(center.contact_visible) or (
            bool(center.claimed) and bool(center.owner_user_id) and center.owner_user_id in owners
        )
        if public and _center_landing_path(center):
            out.append(center)
    return out


def _published_posts(db: Session) -> list[Post]:
    return (
        db.query(Post)
        .filter(
            Post.status == PostStatus.published,
            Post.deleted_at.is_(None),
            Post.seo_noindex.is_(False),
        )
        .all()
    )


def _all_url_entries(db: Session) -> list[str]:
    entries = [_url_entry(_abs_url(path)) for path in STATIC_PAGES]
    partners = (
        db.query(UserProfile.slug, ClientLandingPage.updated_at)
        .join(ClientLandingPage, ClientLandingPage.user_id == UserProfile.user_id)
        .filter(ClientLandingPage.is_published.is_(True), UserProfile.slug.isnot(None))
        .all()
    )
    for slug, updated_at in partners:
        if slug:
            entries.append(_url_entry(_abs_url(f"/partners/{slug}"), updated_at))

    posts = _published_posts(db)
    latest_by_author: dict[int, datetime | None] = {}
    for post in posts:
        image = resolve_image_url(post.featured_image_key)
        image_url = _abs_url(image) if image else None
        entries.append(
            _url_entry(
                _abs_url(f"/blog/{post.slug}"),
                post.updated_at or post.published_at,
                image_url,
            )
        )
        if post.author_id:
            latest_by_author[post.author_id] = _latest(
                latest_by_author.get(post.author_id),
                post.updated_at or post.published_at,
            )
    if latest_by_author:
        authors = db.query(Author).filter(Author.id.in_(latest_by_author.keys())).all()
        for author in authors:
            if author.slug:
                entries.append(
                    _url_entry(_abs_url(f"/author/{author.slug}"), latest_by_author.get(author.id))
                )

    centers = _indexable_centers(db)
    states: dict[str, datetime | None] = {}
    cities: dict[tuple[str, str], datetime | None] = {}
    for center in centers:
        path = _center_landing_path(center)
        if not path:
            continue
        lastmod = center.updated_at or center.published_at
        entries.append(_url_entry(_abs_url(path), lastmod))
        state = _slugify_segment(center.state or (center.location_display or "").split(",")[-1].strip())
        city = _slugify_segment(center.city or (center.location_display or "").split(",")[0].strip())
        if state:
            states[state] = _latest(states.get(state), lastmod)
        if state and city:
            cities[(state, city)] = _latest(cities.get((state, city)), lastmod)
    for state, lastmod in sorted(states.items()):
        entries.append(_url_entry(_abs_url(f"/rehab-centers/state/{state}"), lastmod))
    for (state, city), lastmod in sorted(cities.items()):
        entries.append(_url_entry(_abs_url(f"/rehab-centers/state/{state}/city/{city}"), lastmod))

    rows = (
        db.query(InsuranceCatalog)
        .filter(InsuranceCatalog.enabled.is_(True))
        .order_by(InsuranceCatalog.sort_order.asc(), InsuranceCatalog.name.asc())
        .all()
    )
    for row in rows:
        entries.append(_url_entry(_abs_url(f"/insurance/{row.slug}"), row.updated_at))
    for slug in INSURANCE_GUIDE_SLUGS:
        entries.append(_url_entry(_abs_url(f"/insurance-coverage/guides/{slug}")))
    return entries


@router.get("/sitemap.xml", include_in_schema=False)
def sitemap_index(db: Annotated[Session, Depends(get_db)]) -> Response:
    entries = _all_url_entries(db)
    return _xml_response(_urlset(entries, with_images=any("image:image" in item for item in entries)))


@router.get("/robots.txt", include_in_schema=False)
def robots_txt() -> Response:
    sitemap = _abs_url("/sitemap.xml")
    body = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /admin\n"
        "Disallow: /admin/\n"
        "Disallow: /client\n"
        "Disallow: /client/\n"
        "Disallow: /editor\n"
        "Disallow: /editor/\n"
        "Disallow: /api/\n"
        "Disallow: /login\n"
        "Disallow: /register\n"
        "Disallow: /reset-password\n"
        "Disallow: /confirm-email\n"
        "Disallow: /swa-login\n"
        "Disallow: /provider\n"
        "Disallow: /unsubscribe\n"
        "Disallow: /claim-status/\n"
        "Disallow: /submit-center/\n"
        "\n"
        f"Sitemap: {sitemap}\n"
    )
    return Response(content=body, media_type="text/plain; charset=utf-8", headers=_CACHE_HEADERS)
