"""Public center submissions + admin Submission Center queue."""
from __future__ import annotations

import secrets
import re
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.deps import AdminUser
from app.database import get_db
from app.models.center_submission import CenterSubmission, CenterSubmissionStatus
from app.models.rehab import CenterSource, ListingStatus, RehabCenter
from app.services.email import resolve_email_delivery, send_email
from app.services.samhsa_import import _slugify, _unique_slug

router = APIRouter(tags=["center-submissions"])
settings = get_settings()


class CenterSubmissionCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    center_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=50)
    address_line: str = Field(min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    zip: str | None = Field(default=None, max_length=20)
    services: list[str] = Field(default_factory=list, min_length=1)
    insurances: list[str] = Field(default_factory=list, min_length=1)
    description: str = Field(min_length=20, max_length=8000)
    resume_token: str | None = None


class CenterSubmissionDraft(BaseModel):
    resume_token: str | None = None
    full_name: str | None = Field(default=None, max_length=255)
    center_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    address_line: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    zip: str | None = Field(default=None, max_length=20)
    services: list[str] = Field(default_factory=list)
    insurances: list[str] = Field(default_factory=list)
    description: str | None = Field(default=None, max_length=8000)


class CenterSubmissionOut(BaseModel):
    id: int
    resume_token: str | None = None
    full_name: str
    center_name: str
    email: str
    phone: str
    address_line: str
    city: str
    state: str
    zip: str | None
    services: list[str]
    insurances: list[str]
    description: str
    status: str
    admin_notes: str | None
    reviewed_at: datetime | None
    rehab_center_id: int | None
    created_at: datetime | None = None
    location_display: str | None = None

    model_config = {"from_attributes": True}


class CenterSubmissionReview(BaseModel):
    status: CenterSubmissionStatus
    admin_notes: str | None = None
    create_center: bool = True
    publish: bool = False


def _to_out(row: CenterSubmission, *, include_token: bool = False) -> CenterSubmissionOut:
    parts = [p for p in (row.address_line, row.city, row.state, row.zip) if p]
    return CenterSubmissionOut(
        id=row.id,
        resume_token=row.resume_token if include_token else None,
        full_name=row.full_name or "",
        center_name=row.center_name or "",
        email=row.email or "",
        phone=row.phone or "",
        address_line=row.address_line or "",
        city=row.city or "",
        state=row.state or "",
        zip=row.zip,
        services=list(row.services or []),
        insurances=list(row.insurances or []),
        description=row.description or "",
        status=row.status.value if isinstance(row.status, CenterSubmissionStatus) else str(row.status),
        admin_notes=row.admin_notes,
        reviewed_at=row.reviewed_at,
        rehab_center_id=row.rehab_center_id,
        created_at=row.created_at,
        location_display=", ".join(parts),
    )


def _clean_list(values: list[str], *, max_items: int = 40) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in values:
        item = re.sub(r"\s+", " ", str(raw or "").strip())
        if not item:
            continue
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(item[:120])
        if len(out) >= max_items:
            break
    return out


def _new_resume_token() -> str:
    return secrets.token_urlsafe(24)


def _apply_draft_fields(row: CenterSubmission, body: CenterSubmissionDraft) -> None:
    if body.full_name is not None:
        row.full_name = body.full_name.strip()
    if body.center_name is not None:
        row.center_name = body.center_name.strip()
    if body.email is not None:
        row.email = str(body.email).lower().strip()
    if body.phone is not None:
        row.phone = body.phone.strip()
    if body.address_line is not None:
        row.address_line = body.address_line.strip()
    if body.city is not None:
        row.city = body.city.strip()
    if body.state is not None:
        row.state = body.state.strip()
    if body.zip is not None:
        row.zip = body.zip.strip() or None
    if body.services is not None:
        row.services = _clean_list(body.services)
    if body.insurances is not None:
        row.insurances = _clean_list(body.insurances)
    if body.description is not None:
        row.description = (body.description or "").strip()


def _notify_submission_received(db: Session, row: CenterSubmission) -> None:
    delivery = resolve_email_delivery(db)
    ops = delivery.get("ops_email") or settings.email_from
    location = ", ".join(p for p in (row.address_line, row.city, row.state, row.zip) if p)
    admin_url = f"{settings.admin_site_url.rstrip('/')}/admin/submissions"
    context = {
        "name": row.full_name,
        "email": row.email,
        "lead_phone": row.phone,
        "center_name": row.center_name,
        "location": location,
        "services": ", ".join(row.services or []),
        "insurances": ", ".join(row.insurances or []),
        "description": row.description or "",
        "admin_submissions_url": admin_url,
        "submission_id": str(row.id),
    }
    if ops:
        send_email(
            db,
            to_email=ops,
            template_key="admin_new_center_submission",
            context=context,
        )
    send_email(
        db,
        to_email=row.email,
        template_key="center_submission_received",
        context=context,
    )


@router.post("/api/center-submissions/draft", response_model=CenterSubmissionOut)
def save_submission_draft(body: CenterSubmissionDraft, db: Annotated[Session, Depends(get_db)]):
    """Autosave unfinished submit-your-center forms so we can email a continue link."""
    email = str(body.email).lower().strip() if body.email else ""
    center_name = (body.center_name or "").strip()
    if not email and not body.resume_token:
        raise HTTPException(status_code=400, detail="Email is required to save a draft")
    if not center_name and not body.resume_token:
        raise HTTPException(status_code=400, detail="Center name is required to save a draft")

    row: CenterSubmission | None = None
    if body.resume_token:
        row = (
            db.query(CenterSubmission)
            .filter(
                CenterSubmission.resume_token == body.resume_token,
                CenterSubmission.status.in_(
                    [CenterSubmissionStatus.draft, CenterSubmissionStatus.abandoned]
                ),
            )
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Draft not found")

    if not row:
        row = CenterSubmission(
            resume_token=_new_resume_token(),
            status=CenterSubmissionStatus.draft,
            full_name="",
            center_name=center_name,
            email=email,
            phone="",
            address_line="",
            city="",
            state="",
            description="",
            services=[],
            insurances=[],
        )
        db.add(row)

    if row.status == CenterSubmissionStatus.abandoned:
        row.status = CenterSubmissionStatus.draft
        row.abandon_lead_created_at = None

    _apply_draft_fields(row, body)
    if not row.resume_token:
        row.resume_token = _new_resume_token()
    db.commit()
    db.refresh(row)
    return _to_out(row, include_token=True)


@router.get("/api/center-submissions/resume/{token}", response_model=CenterSubmissionOut)
def get_submission_draft(token: str, db: Annotated[Session, Depends(get_db)]):
    row = (
        db.query(CenterSubmission)
        .filter(CenterSubmission.resume_token == token)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Submission not found")
    if row.status not in (
        CenterSubmissionStatus.draft,
        CenterSubmissionStatus.abandoned,
        CenterSubmissionStatus.pending,
    ):
        raise HTTPException(status_code=400, detail="This submission can no longer be edited")
    return _to_out(row, include_token=True)


@router.post("/api/center-submissions", response_model=CenterSubmissionOut)
def submit_center(body: CenterSubmissionCreate, db: Annotated[Session, Depends(get_db)]):
    services = _clean_list(body.services)
    insurances = _clean_list(body.insurances)
    if not services:
        raise HTTPException(status_code=400, detail="Select at least one type of service")
    if not insurances:
        raise HTTPException(status_code=400, detail="Select at least one insurance type")

    row: CenterSubmission | None = None
    if body.resume_token:
        row = (
            db.query(CenterSubmission)
            .filter(
                CenterSubmission.resume_token == body.resume_token,
                CenterSubmission.status.in_(
                    [CenterSubmissionStatus.draft, CenterSubmissionStatus.abandoned]
                ),
            )
            .first()
        )

    if row:
        row.full_name = body.full_name.strip()
        row.center_name = body.center_name.strip()
        row.email = str(body.email).lower().strip()
        row.phone = body.phone.strip()
        row.address_line = body.address_line.strip()
        row.city = body.city.strip()
        row.state = body.state.strip()
        row.zip = (body.zip or "").strip() or None
        row.services = services
        row.insurances = insurances
        row.description = (body.description or "").strip()
        row.status = CenterSubmissionStatus.pending
        row.abandon_reminders_sent = 0
        row.reminder_sent_at = None
        row.abandon_lead_created_at = None
    else:
        row = CenterSubmission(
            resume_token=_new_resume_token(),
            full_name=body.full_name.strip(),
            center_name=body.center_name.strip(),
            email=str(body.email).lower().strip(),
            phone=body.phone.strip(),
            address_line=body.address_line.strip(),
            city=body.city.strip(),
            state=body.state.strip(),
            zip=(body.zip or "").strip() or None,
            services=services,
            insurances=insurances,
            description=(body.description or "").strip(),
            status=CenterSubmissionStatus.pending,
        )
        db.add(row)

    db.commit()
    db.refresh(row)
    _notify_submission_received(db, row)
    return _to_out(row, include_token=True)


@router.get("/api/admin/center-submissions", response_model=list[CenterSubmissionOut])
def admin_list_submissions(
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
    rehab_center_id: int | None = Query(default=None),
):
    q = (
        db.query(CenterSubmission)
        .filter(CenterSubmission.status != CenterSubmissionStatus.draft)
    )
    if rehab_center_id:
        center = db.query(RehabCenter).filter(RehabCenter.id == rehab_center_id).first()
        filters = [CenterSubmission.rehab_center_id == rehab_center_id]
        if center and center.name:
            filters.append(CenterSubmission.center_name.ilike(center.name))
        q = q.filter(or_(*filters))
    rows = q.order_by(CenterSubmission.created_at.desc()).limit(300).all()
    return [_to_out(r) for r in rows]


@router.get("/api/admin/center-submissions/pending-count")
def admin_pending_submission_count(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    count = (
        db.query(CenterSubmission)
        .filter(CenterSubmission.status == CenterSubmissionStatus.pending)
        .count()
    )
    return {"count": count}


@router.patch("/api/admin/center-submissions/{submission_id}", response_model=CenterSubmissionOut)
def admin_review_submission(
    submission_id: int,
    body: CenterSubmissionReview,
    admin: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    row = db.query(CenterSubmission).filter(CenterSubmission.id == submission_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Submission not found")
    if body.status not in (CenterSubmissionStatus.approved, CenterSubmissionStatus.rejected):
        raise HTTPException(status_code=400, detail="Status must be approved or rejected")

    row.status = body.status
    row.admin_notes = (body.admin_notes or "").strip() or None
    row.reviewed_at = datetime.now(timezone.utc)
    row.reviewed_by_id = admin.id

    if body.status == CenterSubmissionStatus.approved and body.create_center and not row.rehab_center_id:
        slug = _unique_slug(db, _slugify(row.center_name))
        location_display = ", ".join(p for p in (row.city, row.state) if p)
        center = RehabCenter(
            slug=slug,
            name=row.center_name,
            description=row.description or "",
            location_display=location_display,
            address_line=row.address_line,
            city=row.city,
            state=row.state,
            zip=row.zip,
            phone=row.phone,
            contact_email=row.email,
            outreach_email=row.email,
            specialties=list(row.services or []),
            levels_of_care=list(row.services or []),
            insurances=list(row.insurances or []),
            listing_status=ListingStatus.published if body.publish else ListingStatus.draft,
            published_at=datetime.now(timezone.utc) if body.publish else None,
            source=CenterSource.manual,
            claimed=False,
            contact_visible=False,
        )
        db.add(center)
        db.flush()
        row.rehab_center_id = center.id

    db.commit()
    db.refresh(row)

    if body.status == CenterSubmissionStatus.approved:
        send_email(
            db,
            to_email=row.email,
            template_key="center_submission_approved",
            context={
                "name": row.full_name,
                "center_name": row.center_name,
                "admin_notes": row.admin_notes or "Your facility was added to our directory review queue.",
                "login_url": f"{settings.public_site_url.rstrip('/')}/portal",
            },
        )
    elif body.status == CenterSubmissionStatus.rejected:
        send_email(
            db,
            to_email=row.email,
            template_key="center_submission_rejected",
            context={
                "name": row.full_name,
                "center_name": row.center_name,
                "admin_notes": row.admin_notes or "We were unable to add this facility at this time.",
                "support_email": resolve_email_delivery(db).get("email_from") or settings.email_from,
            },
        )

    return _to_out(row)


@router.delete("/api/admin/center-submissions/{submission_id}")
def admin_delete_submission(
    submission_id: int,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    row = db.query(CenterSubmission).filter(CenterSubmission.id == submission_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Submission not found")
    db.delete(row)
    db.commit()
    return {"id": submission_id, "deleted": True}
