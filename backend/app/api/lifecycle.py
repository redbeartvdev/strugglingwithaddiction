"""Admin-operated lifecycle runbook endpoint.

Call this from a scheduled job once daily, or from the dashboard when testing.
"""
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.deps import AdminUser
from app.database import get_db
from app.models.billing import Subscription
from app.models.email_log import EmailLog
from app.services.abandonment import run_abandonment_jobs
from app.services.email import send_email

router = APIRouter(prefix="/api/admin/lifecycle", tags=["lifecycle"])
settings = get_settings()

# (max_days_left inclusive, min_days_left exclusive, stage key)
RENEWAL_STAGES = (
    (15, 7, "15d"),
    (7, 1, "7d"),
    (1, -0.01, "1d"),
)


@router.post("/run")
def run_lifecycle(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    return run_lifecycle_jobs(db)


def _already_sent_stage(db: Session, *, user_id: int, stage: str, period_end: datetime) -> bool:
    """Idempotent: one email per stage per billing period."""
    window_start = period_end - timedelta(days=20)
    template_key = f"renewal_reminder_{stage}"
    return (
        db.query(EmailLog)
        .filter(
            EmailLog.user_id == user_id,
            EmailLog.template_key == template_key,
            EmailLog.created_at >= window_start,
            EmailLog.status == "sent",
        )
        .first()
        is not None
    )


def run_lifecycle_jobs(db: Session) -> dict:
    """Idempotent lifecycle work callable by the scheduler and the admin dashboard."""
    abandon = run_abandonment_jobs(db)

    renewal_reminders = 0
    stage_counts = {"15d": 0, "7d": 0, "1d": 0}
    now = datetime.now(timezone.utc)
    subs = (
        db.query(Subscription)
        .filter(
            Subscription.status.in_(("active", "trialing")),
            Subscription.current_period_end.isnot(None),
            Subscription.current_period_end >= now,
            Subscription.current_period_end <= now + timedelta(days=16),
        )
        .all()
    )
    for sub in subs:
        if not sub.user or not sub.current_period_end:
            continue
        days_left = (sub.current_period_end - now).total_seconds() / 86400.0
        center = sub.user.owned_center
        for max_days, min_days, stage in RENEWAL_STAGES:
            if not (min_days < days_left <= max_days):
                continue
            if _already_sent_stage(db, user_id=sub.user_id, stage=stage, period_end=sub.current_period_end):
                continue

            days_label = str(max(1, int(round(days_left))))
            sent = send_email(
                db,
                to_email=sub.user.email,
                template_key="renewal_reminder",
                context={
                    "name": sub.user.email,
                    "center_name": center.name if center else "your center",
                    "renewal_date": sub.current_period_end.strftime("%B %-d, %Y"),
                    "billing_url": f"{settings.admin_site_url}/client/billing",
                    "days_left": days_label,
                },
                user_id=sub.user_id,
                rehab_center_id=center.id if center else None,
                meta={"stage": stage, "period_end": sub.current_period_end.isoformat()},
            )
            if sent:
                db.add(
                    EmailLog(
                        to_email=sub.user.email,
                        template_key=f"renewal_reminder_{stage}",
                        subject=f"Renewal reminder ({stage})",
                        status="sent",
                        user_id=sub.user_id,
                        rehab_center_id=center.id if center else None,
                        meta_json=f'{{"stage":"{stage}"}}',
                    )
                )
                renewal_reminders += 1
                stage_counts[stage] += 1

    db.commit()
    claim_reminders = abandon["claim_reminder_day1"] + abandon["claim_reminder_day2"]
    submit_reminders = abandon["submit_reminder_day1"] + abandon["submit_reminder_day2"]
    return {
        "claim_abandon_reminders": claim_reminders,
        "submit_abandon_reminders": submit_reminders,
        "claim_abandonment_leads": abandon["claim_abandonment_lead"],
        "submit_abandonment_leads": abandon["submit_abandonment_lead"],
        "abandonment": abandon,
        "renewal_reminders": renewal_reminders,
        "renewal_by_stage": stage_counts,
        "note": "Schedule POST /api/admin/lifecycle/run once per day using an authenticated admin automation.",
    }
