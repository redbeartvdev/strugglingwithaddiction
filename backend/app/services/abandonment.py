"""Abandonment reminders for unfinished claim and center-submit journeys.

Day 1 and day 2: email with a continue link.
After day 2 with no further action: create a tagged abandonment lead.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.models.center_submission import CenterSubmission, CenterSubmissionStatus
from app.models.lead import CenterLead
from app.models.rehab import ClaimStatus, RehabCenterClaim
from app.services.email import send_email

settings = get_settings()

DAY_1 = timedelta(hours=24)
DAY_2 = timedelta(hours=48)
LEAD_AFTER = timedelta(hours=72)


def _age(created_at: datetime | None, now: datetime) -> timedelta:
    if not created_at:
        return timedelta(0)
    ts = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    return now - ts


def claim_is_incomplete(claim: RehabCenterClaim) -> bool:
    if claim.status in (ClaimStatus.approved, ClaimStatus.rejected, ClaimStatus.abandoned):
        return False
    if claim.abandon_lead_created_at:
        return False
    # Finished journey: paid + certification uploaded (waiting on admin is OK)
    if claim.payment_received_at and claim.business_license_url:
        return False
    return True


def process_claim_abandonment(db: Session, claim: RehabCenterClaim, now: datetime | None = None) -> str | None:
    """Send day-1/day-2 emails or create abandonment lead. Returns action taken."""
    now = now or datetime.now(timezone.utc)
    if not claim_is_incomplete(claim):
        return None

    age = _age(claim.created_at, now)
    sent = int(claim.abandon_reminders_sent or 0)
    center_name = claim.center.name if claim.center else "your center"
    claim_url = f"{settings.public_site_url.rstrip('/')}/claim-status/{claim.ticket_number}"
    context = {
        "name": claim.full_name,
        "center_name": center_name,
        "claim_url": claim_url,
        "continue_url": claim_url,
        "day": "1" if sent == 0 else "2",
    }

    if sent == 0 and age >= DAY_1:
        ok = send_email(
            db,
            to_email=claim.work_email,
            template_key="claim_abandon_reminder",
            context=context,
            user_id=claim.submitter_user_id,
            rehab_center_id=claim.rehab_center_id,
            meta={"day": 1},
        )
        if ok:
            claim.abandon_reminders_sent = 1
            claim.reminder_sent_at = now
            return "claim_reminder_day1"
        return None

    if sent == 1 and age >= DAY_2:
        ok = send_email(
            db,
            to_email=claim.work_email,
            template_key="claim_abandon_reminder",
            context={**context, "day": "2"},
            user_id=claim.submitter_user_id,
            rehab_center_id=claim.rehab_center_id,
            meta={"day": 2},
        )
        if ok:
            claim.abandon_reminders_sent = 2
            claim.reminder_sent_at = now
            return "claim_reminder_day2"
        return None

    if sent >= 2 and age >= LEAD_AFTER and not claim.abandon_lead_created_at:
        lead = CenterLead(
            rehab_center_id=claim.rehab_center_id,
            full_name=claim.full_name,
            email=claim.work_email.lower(),
            phone=claim.phone,
            message=(
                f"Abandonment — claim. Started claiming “{center_name}” "
                f"(ticket {claim.ticket_number}) but did not finish payment/certification."
            ),
            source_url=claim_url,
            source_kind="claim_abandonment",
            tag="abandonment",
            center_name=center_name,
        )
        db.add(lead)
        claim.abandon_lead_created_at = now
        claim.status = ClaimStatus.abandoned
        claim.admin_notes = (claim.admin_notes or "") + (
            f"\n[{now.date().isoformat()}] Marked abandoned after 2 reminder emails; lead created."
        ).lstrip()
        return "claim_abandonment_lead"

    return None


def process_submit_abandonment(db: Session, row: CenterSubmission, now: datetime | None = None) -> str | None:
    """Day-1/day-2 emails for unfinished draft submissions, then abandonment lead."""
    now = now or datetime.now(timezone.utc)
    if row.status != CenterSubmissionStatus.draft or row.abandon_lead_created_at:
        return None
    if not (row.email or "").strip() or not (row.center_name or "").strip():
        return None

    age = _age(row.created_at, now)
    sent = int(row.abandon_reminders_sent or 0)
    token = row.resume_token
    if not token:
        return None
    continue_url = f"{settings.public_site_url.rstrip('/')}/submit-center/{token}"
    center_name = row.center_name.strip()
    context = {
        "name": row.full_name or row.email,
        "center_name": center_name,
        "continue_url": continue_url,
        "day": "1" if sent == 0 else "2",
    }

    if sent == 0 and age >= DAY_1:
        ok = send_email(
            db,
            to_email=row.email,
            template_key="submit_abandon_reminder",
            context=context,
            meta={"day": 1, "submission_id": row.id},
        )
        if ok:
            row.abandon_reminders_sent = 1
            row.reminder_sent_at = now
            return "submit_reminder_day1"
        return None

    if sent == 1 and age >= DAY_2:
        ok = send_email(
            db,
            to_email=row.email,
            template_key="submit_abandon_reminder",
            context={**context, "day": "2"},
            meta={"day": 2, "submission_id": row.id},
        )
        if ok:
            row.abandon_reminders_sent = 2
            row.reminder_sent_at = now
            return "submit_reminder_day2"
        return None

    if sent >= 2 and age >= LEAD_AFTER and not row.abandon_lead_created_at:
        lead = CenterLead(
            rehab_center_id=row.rehab_center_id,
            full_name=(row.full_name or "").strip() or row.email,
            email=row.email.lower().strip(),
            phone=(row.phone or "").strip() or None,
            message=(
                f"Abandonment — submit. Started adding “{center_name}” "
                f"but did not finish the center submission."
            ),
            source_url=continue_url,
            source_kind="submit_abandonment",
            tag="abandonment",
            center_name=center_name,
        )
        db.add(lead)
        row.abandon_lead_created_at = now
        row.status = CenterSubmissionStatus.abandoned
        return "submit_abandonment_lead"

    return None


def run_abandonment_jobs(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    counts = {
        "claim_reminder_day1": 0,
        "claim_reminder_day2": 0,
        "claim_abandonment_lead": 0,
        "submit_reminder_day1": 0,
        "submit_reminder_day2": 0,
        "submit_abandonment_lead": 0,
    }

    claims = (
        db.query(RehabCenterClaim)
        .options(joinedload(RehabCenterClaim.center))
        .filter(
            RehabCenterClaim.status.notin_(
                [ClaimStatus.approved, ClaimStatus.rejected, ClaimStatus.abandoned]
            ),
            RehabCenterClaim.abandon_lead_created_at.is_(None),
        )
        .all()
    )
    for claim in claims:
        action = process_claim_abandonment(db, claim, now)
        if action and action in counts:
            counts[action] += 1

    drafts = (
        db.query(CenterSubmission)
        .filter(
            CenterSubmission.status == CenterSubmissionStatus.draft,
            CenterSubmission.abandon_lead_created_at.is_(None),
        )
        .all()
    )
    for row in drafts:
        action = process_submit_abandonment(db, row, now)
        if action and action in counts:
            counts[action] += 1

    return counts
