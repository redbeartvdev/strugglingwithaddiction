"""Public center submissions + admin Submission Center queue."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
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


class CenterSubmissionOut(BaseModel):
    id: int
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


def _to_out(row: CenterSubmission) -> CenterSubmissionOut:
    parts = [p for p in (row.address_line, row.city, row.state, row.zip) if p]
    return CenterSubmissionOut(
        id=row.id,
        full_name=row.full_name,
        center_name=row.center_name,
        email=row.email,
        phone=row.phone,
        address_line=row.address_line,
        city=row.city,
        state=row.state,
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


@router.post("/api/center-submissions", response_model=CenterSubmissionOut)
def submit_center(body: CenterSubmissionCreate, db: Annotated[Session, Depends(get_db)]):
    services = _clean_list(body.services)
    insurances = _clean_list(body.insurances)
    if not services:
        raise HTTPException(status_code=400, detail="Select at least one type of service")
    if not insurances:
        raise HTTPException(status_code=400, detail="Select at least one insurance type")

    row = CenterSubmission(
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
        "services": ", ".join(services),
        "insurances": ", ".join(insurances),
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
    return _to_out(row)


@router.get("/api/admin/center-submissions", response_model=list[CenterSubmissionOut])
def admin_list_submissions(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    rows = (
        db.query(CenterSubmission)
        .order_by(CenterSubmission.created_at.desc())
        .limit(300)
        .all()
    )
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
                "login_url": f"{settings.admin_site_url.rstrip('/')}/login",
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
