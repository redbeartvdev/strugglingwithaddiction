"""Listing page-view tracking + provider/admin analytics."""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import ActiveSubscriber, AdminUser
from app.database import get_db
from app.models.analytics import CenterPageView, SitePageView
from app.models.lead import CenterLead
from app.models.rehab import ListingStatus, RehabCenter

router = APIRouter(tags=["analytics"])

RANGE_PRESETS = {
    "1h": timedelta(hours=1),
    "12h": timedelta(hours=12),
    "today": None,  # calendar day
    "week": timedelta(days=7),
    "month": timedelta(days=30),
    "year": timedelta(days=365),
}

SKIP_SITE_PATH_PREFIXES = (
    "/provider",
    "/swa-login",
    "/unsubscribe",
    "/claim-status",
)


class TrackViewBody(BaseModel):
    path: str | None = None
    referrer: str | None = None
    visitor_state: str | None = Field(default=None, max_length=64)
    device_type: str | None = Field(default=None, max_length=32)
    session_key: str | None = Field(default=None, max_length=64)


class TrackSiteViewBody(BaseModel):
    path: str = Field(min_length=1, max_length=512)
    page_title: str | None = Field(default=None, max_length=255)
    referrer: str | None = None
    visitor_state: str | None = Field(default=None, max_length=64)
    device_type: str | None = Field(default=None, max_length=32)
    session_key: str | None = Field(default=None, max_length=64)


def _parse_device(ua: str | None, override: str | None = None) -> str:
    if override in ("mobile", "tablet", "desktop"):
        return override
    text = (ua or "").lower()
    if "ipad" in text or "tablet" in text or "kindle" in text:
        return "tablet"
    if "mobi" in text or "iphone" in text or "android" in text:
        return "mobile"
    return "desktop"


def _normalize_state(value: str | None) -> str:
    state = (value or "").strip() or "Unknown"
    return state[:64]


def _resolve_range(
    range_key: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    if date_from or date_to:
        start = date_from or (now - timedelta(days=30))
        end = date_to or now
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        if end < start:
            raise HTTPException(status_code=400, detail="date_to must be after date_from")
        return start, end

    key = (range_key or "today").lower()
    if key not in RANGE_PRESETS and key != "custom":
        raise HTTPException(status_code=400, detail=f"Unknown range: {range_key}")

    if key == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, now

    delta = RANGE_PRESETS.get(key) or timedelta(days=1)
    return now - delta, now


def _bucket_fmt(start: datetime, end: datetime) -> tuple[timedelta, str]:
    span = end - start
    if span <= timedelta(hours=12):
        return timedelta(hours=1), "%Y-%m-%d %H:00"
    if span <= timedelta(days=14):
        return timedelta(days=1), "%Y-%m-%d"
    return timedelta(days=7), "%Y-%m-%d"


def _bucket_series(
    views: list[Any],
    leads: list[CenterLead],
    start: datetime,
    end: datetime,
    *,
    visited_attr: str = "visited_at",
) -> list[dict]:
    step, fmt = _bucket_fmt(start, end)

    buckets: list[datetime] = []
    cursor = start
    while cursor <= end:
        buckets.append(cursor)
        cursor += step
    if not buckets:
        buckets = [start]

    view_counts: Counter[str] = Counter()
    lead_counts: Counter[str] = Counter()
    for v in views:
        at = getattr(v, visited_attr, None)
        key = at.astimezone(timezone.utc).strftime(fmt) if at else ""
        view_counts[key] += 1
    for lead in leads:
        key = lead.created_at.astimezone(timezone.utc).strftime(fmt) if lead.created_at else ""
        lead_counts[key] += 1

    series = []
    for b in buckets:
        label = b.astimezone(timezone.utc).strftime(fmt)
        series.append({"label": label, "views": view_counts.get(label, 0), "leads": lead_counts.get(label, 0)})
    return series


def _should_skip_site_path(path: str) -> bool:
    cleaned = path.split("?")[0].rstrip("/") or "/"
    for prefix in SKIP_SITE_PATH_PREFIXES:
        if cleaned == prefix or cleaned.startswith(prefix + "/"):
            return True
    return False


@router.post("/api/rehab-centers/{slug}/views")
def track_center_view(
    slug: str,
    body: TrackViewBody,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
):
    center = db.query(RehabCenter).filter(
        RehabCenter.slug == slug,
        RehabCenter.listing_status == ListingStatus.published,
        RehabCenter.deleted_at.is_(None),
    ).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")

    ua = request.headers.get("user-agent")
    device = _parse_device(ua, body.device_type)

    view = CenterPageView(
        rehab_center_id=center.id,
        visitor_state=_normalize_state(body.visitor_state),
        device_type=device,
        path=(body.path or "")[:512] or None,
        referrer=(body.referrer or "")[:512] or None,
        session_key=(body.session_key or "")[:64] or None,
    )
    db.add(view)
    db.commit()
    return {"ok": True}


@router.post("/api/analytics/pageview")
def track_site_pageview(
    body: TrackSiteViewBody,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
):
    path = (body.path or "").strip()[:512]
    if not path.startswith("/"):
        path = f"/{path}"
    if _should_skip_site_path(path):
        return {"ok": True, "skipped": True}

    ua = request.headers.get("user-agent")
    device = _parse_device(ua, body.device_type)
    view = SitePageView(
        path=path.split("?")[0][:512],
        page_title=(body.page_title or "").strip()[:255] or None,
        referrer=(body.referrer or "")[:512] or None,
        visitor_state=_normalize_state(body.visitor_state),
        device_type=device,
        session_key=(body.session_key or "")[:64] or None,
    )
    db.add(view)
    db.commit()
    return {"ok": True}


@router.get("/api/client/analytics")
def client_analytics(
    user: ActiveSubscriber,
    db: Annotated[Session, Depends(get_db)],
    range: str | None = Query(default="today"),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> dict[str, Any]:
    from app.api.leads_upsells import _client_center

    center = _client_center(db, user)
    if not center:
        raise HTTPException(status_code=404, detail="No center linked")

    start, end = _resolve_range(range, date_from, date_to)

    views = (
        db.query(CenterPageView)
        .filter(
            CenterPageView.rehab_center_id == center.id,
            CenterPageView.visited_at >= start,
            CenterPageView.visited_at <= end,
        )
        .order_by(CenterPageView.visited_at.asc())
        .all()
    )
    leads = (
        db.query(CenterLead)
        .filter(
            CenterLead.rehab_center_id == center.id,
            CenterLead.created_at >= start,
            CenterLead.created_at <= end,
        )
        .order_by(CenterLead.created_at.asc())
        .all()
    )

    unique_sessions = len({v.session_key for v in views if v.session_key})
    state_counts = Counter((v.visitor_state or "Unknown") for v in views)
    device_counts = Counter((v.device_type or "desktop") for v in views)

    lead_states: Counter[str] = Counter()
    for lead in leads:
        state = "Unknown"
        if lead.source_url:
            parts = urlparse(lead.source_url).path.strip("/").split("/")
            if len(parts) >= 3 and parts[0] == "rehabs" and parts[1] == "united-states":
                state = parts[2].replace("-", " ").title()
        lead_states[state] += 1

    return {
        "center_id": center.id,
        "center_name": center.name,
        "range": range or "custom",
        "date_from": start.isoformat(),
        "date_to": end.isoformat(),
        "summary": {
            "page_views": len(views),
            "unique_sessions": unique_sessions or len(views),
            "leads": len(leads),
            "unread_leads": sum(1 for l in leads if not l.read_at),
            "conversion_rate": round((len(leads) / len(views)) * 100, 1) if views else 0.0,
        },
        "by_state": [
            {"state": k, "views": v, "leads": lead_states.get(k, 0)}
            for k, v in state_counts.most_common(25)
        ],
        "by_device": [
            {"device": k, "views": v}
            for k, v in device_counts.most_common()
        ],
        "series": _bucket_series(views, leads, start, end),
        "recent_leads": [
            {
                "id": l.id,
                "full_name": l.full_name,
                "email": l.email,
                "created_at": l.created_at.isoformat() if l.created_at else None,
                "read_at": l.read_at.isoformat() if l.read_at else None,
            }
            for l in sorted(leads, key=lambda x: x.created_at or start, reverse=True)[:8]
        ],
    }


@router.get("/api/admin/analytics")
def admin_analytics(
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
    range: str | None = Query(default="today"),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> dict[str, Any]:
    start, end = _resolve_range(range, date_from, date_to)

    site_views = (
        db.query(SitePageView)
        .filter(SitePageView.visited_at >= start, SitePageView.visited_at <= end)
        .order_by(SitePageView.visited_at.asc())
        .all()
    )
    profile_views = (
        db.query(CenterPageView)
        .filter(CenterPageView.visited_at >= start, CenterPageView.visited_at <= end)
        .order_by(CenterPageView.visited_at.asc())
        .all()
    )
    leads = (
        db.query(CenterLead)
        .filter(CenterLead.created_at >= start, CenterLead.created_at <= end)
        .order_by(CenterLead.created_at.asc())
        .all()
    )

    unique_sessions = len({v.session_key for v in site_views if v.session_key})
    state_counts = Counter((v.visitor_state or "Unknown") for v in site_views)
    device_counts = Counter((v.device_type or "desktop") for v in site_views)

    # Top landing pages (prefer latest non-empty title per path)
    path_counts: Counter[str] = Counter()
    path_titles: dict[str, str] = {}
    for v in site_views:
        path = v.path or "/"
        path_counts[path] += 1
        if v.page_title and path not in path_titles:
            path_titles[path] = v.page_title
    top_landing_pages = [
        {"path": path, "title": path_titles.get(path), "views": count}
        for path, count in path_counts.most_common(15)
    ]

    # Top profile visits
    profile_counts: Counter[int] = Counter(v.rehab_center_id for v in profile_views)
    center_ids = list({*profile_counts.keys(), *(l.rehab_center_id for l in leads)})
    centers_by_id = {
        c.id: c
        for c in db.query(RehabCenter).filter(RehabCenter.id.in_(center_ids)).all()
    } if center_ids else {}

    top_profiles = []
    for center_id, count in profile_counts.most_common(15):
        center = centers_by_id.get(center_id)
        top_profiles.append({
            "center_id": center_id,
            "name": center.name if center else f"Center #{center_id}",
            "slug": center.slug if center else None,
            "city": center.city if center else None,
            "state": center.state if center else None,
            "views": count,
        })

    # Top centers by leads
    lead_counts: Counter[int] = Counter(l.rehab_center_id for l in leads)
    top_leads = []
    for center_id, count in lead_counts.most_common(15):
        center = centers_by_id.get(center_id)
        top_leads.append({
            "center_id": center_id,
            "name": center.name if center else f"Center #{center_id}",
            "slug": center.slug if center else None,
            "leads": count,
            "unread": sum(1 for l in leads if l.rehab_center_id == center_id and not l.read_at),
        })

    profile_view_total = len(profile_views)
    site_view_total = len(site_views)
    lead_total = len(leads)

    return {
        "range": range or "custom",
        "date_from": start.isoformat(),
        "date_to": end.isoformat(),
        "summary": {
            "site_visits": site_view_total,
            "unique_sessions": unique_sessions or site_view_total,
            "profile_visits": profile_view_total,
            "leads": lead_total,
            "unread_leads": sum(1 for l in leads if not l.read_at),
            "conversion_rate": round((lead_total / profile_view_total) * 100, 1) if profile_view_total else 0.0,
        },
        "series": _bucket_series(site_views, leads, start, end),
        "top_landing_pages": top_landing_pages,
        "top_profiles": top_profiles,
        "top_leads": top_leads,
        "by_state": [
            {"state": k, "views": v}
            for k, v in state_counts.most_common(25)
        ],
        "by_device": [
            {"device": k, "views": v}
            for k, v in device_counts.most_common()
        ],
        "recent_leads": [
            {
                "id": l.id,
                "full_name": l.full_name,
                "email": l.email,
                "center_name": (centers_by_id.get(l.rehab_center_id).name
                                if centers_by_id.get(l.rehab_center_id) else None),
                "created_at": l.created_at.isoformat() if l.created_at else None,
                "read_at": l.read_at.isoformat() if l.read_at else None,
            }
            for l in sorted(leads, key=lambda x: x.created_at or start, reverse=True)[:10]
        ],
    }
