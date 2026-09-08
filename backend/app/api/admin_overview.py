"""Single-call snapshot for the admin Overview tab."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.deps import AdminUser
from app.database import get_db
from app.models.analytics import CenterPageView, SitePageView
from app.models.billing import BillingInterval, Subscription
from app.models.blog import Post, PostStatus
from app.models.center_submission import CenterSubmission, CenterSubmissionStatus
from app.models.email_list import EmailListContact
from app.models.email_log import EmailLog
from app.models.lead import CenterLead
from app.models.rehab import ClaimStatus, ListingStatus, RehabCenter, RehabCenterClaim
from app.models.upsell import UpsellOrder, UpsellOrderStatus
from app.models.user import User
from app.api.rehab_helpers import inquiry_forms_globally_enabled
from app.services.email_list import source_counts
from app.services.mailchimp import resolve_mailchimp
from app.services.stripe_config import stripe_status_payload

router = APIRouter(tags=["admin-overview"])

ABANDONMENT_FILTER = or_(
    CenterLead.tag == "abandonment",
    CenterLead.source_kind.in_(("claim_abandonment", "submit_abandonment")),
)
PENDING_CLAIM_STATUSES = (ClaimStatus.pending, ClaimStatus.under_review)
ACTIVE_SUB_STATUSES = ("active", "trialing", "past_due")


def _today_bounds() -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start, now


def _enum_value(value: Any) -> str:
    return value.value if hasattr(value, "value") else str(value or "")


def _claim_status_label(status: Any) -> str:
    raw = _enum_value(status)
    if raw == "rejected":
        return "disapproved"
    if raw in ("certified", "approved"):
        return "approved"
    if raw in ("pending", "under_review"):
        return "pending"
    return raw or "unknown"


def _claim_tone(status: Any) -> str:
    raw = _enum_value(status)
    if raw in ("pending", "under_review"):
        return "warn"
    if raw in ("approved", "certified"):
        return "ok"
    return "info"


def _money(cents: int) -> str:
    return f"USD {max(0, int(cents or 0)) / 100:.2f}"


def _empty_contact_email():
    return or_(
        RehabCenter.contact_email.is_(None),
        func.trim(func.coalesce(RehabCenter.contact_email, "")) == "",
    )


@router.get("/api/admin/overview")
def admin_overview(_: AdminUser, db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    start, now = _today_bounds()
    live_centers = RehabCenter.deleted_at.is_(None)

    users_by_role = {"admin": 0, "editor": 0, "client": 0}
    for role, count in db.query(User.role, func.count(User.id)).group_by(User.role).all():
        key = _enum_value(role)
        if key in users_by_role:
            users_by_role[key] = int(count or 0)
    users_total = sum(users_by_role.values())

    centers_total = db.query(func.count(RehabCenter.id)).filter(live_centers).scalar() or 0
    claimed = (
        db.query(func.count(RehabCenter.id))
        .filter(live_centers, RehabCenter.claimed.is_(True))
        .scalar()
        or 0
    )
    published = (
        db.query(func.count(RehabCenter.id))
        .filter(live_centers, RehabCenter.listing_status == ListingStatus.published)
        .scalar()
        or 0
    )
    missing_inquiry_q = db.query(RehabCenter).filter(
        live_centers,
        RehabCenter.claimed.is_(True),
        _empty_contact_email(),
    )
    missing_inquiry_email = missing_inquiry_q.count()
    missing_inquiry_centers = [
        {
            "id": row.id,
            "name": row.name,
            "location_display": row.location_display or "",
        }
        for row in missing_inquiry_q.order_by(RehabCenter.updated_at.desc()).limit(5).all()
    ]
    inquiry_form_disabled = (
        db.query(func.count(RehabCenter.id))
        .filter(live_centers, RehabCenter.inquiry_form_enabled.is_(False))
        .scalar()
        or 0
    )

    pending_submissions = (
        db.query(func.count(CenterSubmission.id))
        .filter(CenterSubmission.status == CenterSubmissionStatus.pending)
        .scalar()
        or 0
    )
    pending_claims = (
        db.query(func.count(RehabCenterClaim.id))
        .filter(RehabCenterClaim.status.in_(PENDING_CLAIM_STATUSES))
        .scalar()
        or 0
    )

    abandon_base = db.query(func.count(CenterLead.id)).filter(ABANDONMENT_FILTER)
    abandonment_total = abandon_base.scalar() or 0
    abandonment_unread = (
        db.query(func.count(CenterLead.id))
        .filter(ABANDONMENT_FILTER, CenterLead.read_at.is_(None))
        .scalar()
        or 0
    )
    abandonment_today = (
        db.query(func.count(CenterLead.id))
        .filter(ABANDONMENT_FILTER, CenterLead.created_at >= start, CenterLead.created_at <= now)
        .scalar()
        or 0
    )

    site_visits = (
        db.query(func.count(SitePageView.id))
        .filter(SitePageView.visited_at >= start, SitePageView.visited_at <= now)
        .scalar()
        or 0
    )
    unique_sessions = (
        db.query(func.count(func.distinct(SitePageView.session_key)))
        .filter(
            SitePageView.visited_at >= start,
            SitePageView.visited_at <= now,
            SitePageView.session_key.isnot(None),
            SitePageView.session_key != "",
        )
        .scalar()
        or 0
    )
    profile_visits = (
        db.query(func.count(CenterPageView.id))
        .filter(CenterPageView.visited_at >= start, CenterPageView.visited_at <= now)
        .scalar()
        or 0
    )

    email_total = db.query(func.count(EmailListContact.id)).scalar() or 0
    email_subscribed = (
        db.query(func.count(EmailListContact.id))
        .filter(EmailListContact.status == "subscribed")
        .scalar()
        or 0
    )
    email_synced = (
        db.query(func.count(EmailListContact.id))
        .filter(EmailListContact.mailchimp_synced_at.isnot(None))
        .scalar()
        or 0
    )
    emails_sent_today = (
        db.query(func.count(EmailLog.id))
        .filter(EmailLog.created_at >= start, EmailLog.status == "sent")
        .scalar()
        or 0
    )

    mailchimp = resolve_mailchimp(db)
    inquiry_forms_on = inquiry_forms_globally_enabled(db)

    active_subs = db.query(Subscription).filter(Subscription.status.in_(ACTIVE_SUB_STATUSES)).all()
    mrr_cents = 0
    monthly_count = 0
    yearly_count = 0
    for sub in active_subs:
        if sub.interval == BillingInterval.year:
            mrr_cents += int(9999 / 12)
            yearly_count += 1
        else:
            mrr_cents += 999
            monthly_count += 1
    past_due = db.query(func.count(Subscription.id)).filter(Subscription.status == "past_due").scalar() or 0
    unpaid = (
        db.query(func.count(Subscription.id))
        .filter(Subscription.status.in_(("pending", "past_due", "unpaid", "inactive")))
        .scalar()
        or 0
    )
    upsells_paid = (
        db.query(func.count(UpsellOrder.id))
        .filter(UpsellOrder.status == UpsellOrderStatus.paid)
        .scalar()
        or 0
    )
    posts_published = (
        db.query(func.count(Post.id))
        .filter(Post.deleted_at.is_(None), Post.status == PostStatus.published)
        .scalar()
        or 0
    )

    recent_centers = (
        db.query(RehabCenter)
        .filter(live_centers)
        .order_by(RehabCenter.updated_at.desc())
        .limit(3)
        .all()
    )
    recent_claims = (
        db.query(RehabCenterClaim)
        .options(joinedload(RehabCenterClaim.center))
        .order_by(RehabCenterClaim.created_at.desc())
        .limit(4)
        .all()
    )
    recent_submissions = (
        db.query(CenterSubmission)
        .filter(CenterSubmission.status != CenterSubmissionStatus.draft)
        .order_by(CenterSubmission.created_at.desc())
        .limit(4)
        .all()
    )
    recent_leads = (
        db.query(CenterLead)
        .filter(ABANDONMENT_FILTER)
        .order_by(CenterLead.created_at.desc())
        .limit(4)
        .all()
    )

    activity: list[dict[str, Any]] = []
    for row in recent_submissions:
        status = _enum_value(row.status)
        activity.append({
            "kind": "submission",
            "time": row.created_at.isoformat() if row.created_at else None,
            "msg": f"Submission — {row.center_name} ({status})",
            "tone": "warn" if status == "pending" else "ok" if status == "approved" else "info",
            "href": "/admin/submissions",
        })
    for row in recent_claims:
        status = _enum_value(row.status)
        center_name = row.center.name if row.center else "Listing"
        activity.append({
            "kind": "claim",
            "time": row.created_at.isoformat() if row.created_at else None,
            "msg": f"{row.ticket_number} — {center_name} ({_claim_status_label(status)})",
            "tone": _claim_tone(status),
            "href": "/admin/claims",
        })
    for row in recent_leads:
        kind = row.source_kind or "abandonment"
        label = "claim" if "claim" in kind else "submit" if "submit" in kind else "journey"
        activity.append({
            "kind": "abandonment",
            "time": row.created_at.isoformat() if row.created_at else None,
            "msg": f"Abandoned {label} — {row.center_name or row.full_name or row.email}",
            "tone": "warn" if row.read_at is None else "info",
            "href": "/admin/leads",
        })
    activity.sort(key=lambda item: item.get("time") or "", reverse=True)

    attention: list[dict[str, Any]] = []
    if pending_submissions:
        attention.append({
            "key": "submissions",
            "count": pending_submissions,
            "label": f"{pending_submissions} center submission{'s' if pending_submissions != 1 else ''} awaiting review",
            "to": "/admin/submissions",
        })
    if pending_claims:
        attention.append({
            "key": "claims",
            "count": pending_claims,
            "label": f"{pending_claims} claim{'s' if pending_claims != 1 else ''} awaiting review",
            "to": "/admin/claims",
        })
    if missing_inquiry_email:
        attention.append({
            "key": "inquiry_setup",
            "count": missing_inquiry_email,
            "label": f"{missing_inquiry_email} claimed center{'s' if missing_inquiry_email != 1 else ''} missing an inquiry inbox",
            "to": "/admin/rehab",
        })
    if abandonment_unread:
        attention.append({
            "key": "abandonment",
            "count": abandonment_unread,
            "label": f"{abandonment_unread} unread abandonment lead{'s' if abandonment_unread != 1 else ''}",
            "to": "/admin/leads",
        })
    if not inquiry_forms_on:
        attention.append({
            "key": "inquiry_forms",
            "count": 1,
            "label": "Listing inquiry forms are turned off site-wide",
            "to": "/admin/settings?tab=site",
        })
    if not mailchimp["configured"] and mailchimp["enabled"]:
        attention.append({
            "key": "mailchimp",
            "count": 1,
            "label": "Mailchimp is enabled but not fully configured",
            "to": "/admin/settings?tab=mailchimp",
        })
    if past_due:
        attention.append({
            "key": "past_due",
            "count": past_due,
            "label": f"{past_due} subscription{'s' if past_due != 1 else ''} past due",
            "to": "/admin/billing",
        })
    if upsells_paid:
        attention.append({
            "key": "upsells",
            "count": upsells_paid,
            "label": f"{upsells_paid} paid upgrade{'s' if upsells_paid != 1 else ''} awaiting fulfillment",
            "to": "/admin/upsells",
        })

    return {
        "generated_at": now.isoformat(),
        "users": {
            "total": users_total,
            **users_by_role,
        },
        "centers": {
            "total": int(centers_total),
            "claimed": int(claimed),
            "unclaimed": int(centers_total) - int(claimed),
            "published": int(published),
            "missing_inquiry_email": int(missing_inquiry_email),
            "inquiry_form_disabled": int(inquiry_form_disabled),
            "missing_inquiry_centers": missing_inquiry_centers,
        },
        "queue": {
            "pending_submissions": int(pending_submissions),
            "pending_claims": int(pending_claims),
        },
        "leads": {
            "abandonment_total": int(abandonment_total),
            "unread": int(abandonment_unread),
            "today": int(abandonment_today),
        },
        "traffic": {
            "site_visits": int(site_visits),
            "unique_sessions": int(unique_sessions or site_visits),
            "profile_visits": int(profile_visits),
        },
        "email_list": {
            "total": int(email_total),
            "subscribed": int(email_subscribed),
            "unsubscribed": int(email_total) - int(email_subscribed),
            "mailchimp_synced": int(email_synced),
            "mailchimp_unsynced": max(0, int(email_subscribed) - int(email_synced)),
            "by_source": source_counts(db),
            "emails_sent_today": int(emails_sent_today),
        },
        "mailchimp": {
            "enabled": bool(mailchimp["enabled"]),
            "configured": bool(mailchimp["configured"]),
            "abandonment_emails_enabled": bool(mailchimp["abandonment_emails_enabled"]),
            "abandonment_uses_mailchimp": (not mailchimp["abandonment_emails_enabled"]) and mailchimp["configured"],
        },
        "inquiries": {
            "forms_globally_enabled": bool(inquiry_forms_on),
        },
        "finance": {
            "mrr_cents": mrr_cents,
            "mrr_label": _money(mrr_cents),
            "active_subscribers": len(active_subs),
            "monthly_subscribers": monthly_count,
            "yearly_subscribers": yearly_count,
            "past_due_count": int(past_due),
            "unpaid_count": int(unpaid),
            "upsells_awaiting_fulfillment": int(upsells_paid),
            "stripe_configured": bool(stripe_status_payload(db).get("configured")),
        },
        "posts": {
            "published": int(posts_published),
        },
        "attention": attention,
        "recent_centers": [
            {
                "id": row.id,
                "name": row.name,
                "location_display": row.location_display or "",
                "claimed": bool(row.claimed),
                "needs_inquiry_setup": bool(row.claimed) and not (row.contact_email or "").strip(),
            }
            for row in recent_centers
        ],
        "recent_activity": activity[:8],
    }
