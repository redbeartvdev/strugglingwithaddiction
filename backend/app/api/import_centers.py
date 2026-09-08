from typing import Annotated
from datetime import datetime, timezone
import threading

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import create_action_token, decode_token
from app.core.deps import AdminUser
from app.database import get_db
from app.models.rehab import RehabCenter
from app.services.email import send_email
from app.services.import_jobs import create_import_job, get_import_job, run_import_job
from app.services.samhsa_import import (
    CSV_HEADERS,
    MAX_IMPORT_BYTES,
    MAX_IMPORT_ROWS,
    build_template_csv,
)

router = APIRouter(tags=["import"])
settings = get_settings()


class ImportSummary(BaseModel):
    created: int
    updated: int
    skipped: int
    total_rows: int
    errors: list[str] = Field(default_factory=list)
    headers: list[str] = Field(default_factory=lambda: list(CSV_HEADERS))


class ImportJobStart(BaseModel):
    job_id: str
    status: str


class ImportJobStatus(BaseModel):
    job_id: str
    filename: str = ""
    status: str
    phase: str = "queued"
    message: str = ""
    processed: int = 0
    total: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    total_rows: int = 0
    percent: int = 0
    errors: list[str] = Field(default_factory=list)


class OutreachResult(BaseModel):
    sent: int
    skipped: int
    errors: list[str] = Field(default_factory=list)


@router.get("/api/admin/import/template")
def download_import_template(_: AdminUser):
    csv_text = build_template_csv()
    return PlainTextResponse(
        csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="samhsa-listing-import-template.csv"'},
    )


@router.get("/api/admin/import/columns")
def import_columns(_: AdminUser):
    return {
        "headers": CSV_HEADERS,
        "required": ["name2 or name1 or name"],
        "notes": [
            "Column order: name1, name2, street1, street2, city, state, zip, phone, intake1, intake2, intake1a, intake2a, service_code_info.",
            "name1 is the business name. name2 is the listing title. If name2 is empty, the listing is created with name1.",
            "street1 is address 1. street2 is address 2 (suite / unit). If street2 is present it is appended to the listing address.",
            "intake1, intake2, intake1a, and intake2a are stored on the listing. The public phone uses the phone column, or the first available intake number.",
            "city, state, zip, and phone are imported from those columns when present.",
            "List columns (specialties, levels_of_care, service_codes, insurances, amenities, accreditations) use | or ; separators.",
            "service_code_info accepts SAMHSA locator text: category groups split by * and codes split by spaces (e.g. SA MH SUMH * OP * CMHC * CBT CFT GT IDD IPT TELE * CH/AD YAD ADLT SNR).",
            "Individual catalog columns (SA, OP, CBT, CH/AD, …) with Yes/1/X are also imported and matched to the Service codes catalog.",
            "Upsert key: samhsa_id when present; otherwise name + city + state.",
            "Imported rows publish as basic unclaimed listings (claim CTA enabled).",
            "Photo, gallery, and logo columns are ignored. Every import gets the SWA logo plus a shared placeholder image.",
            f"Accepts .csv, .xls, and .xlsx up to {MAX_IMPORT_ROWS:,} rows / {MAX_IMPORT_BYTES // (1024 * 1024)} MB.",
        ],
    }


@router.post("/api/admin/import/centers", response_model=ImportJobStart)
async def import_centers_csv_endpoint(
    _: AdminUser,
    file: UploadFile = File(...),
    publish: bool = True,
):
    content = await file.read()
    if len(content) > MAX_IMPORT_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is too large. Upload a CSV or Excel file under {MAX_IMPORT_BYTES // (1024 * 1024)} MB.",
        )
    filename = file.filename or "import.csv"
    job = create_import_job(filename)
    threading.Thread(
        target=run_import_job,
        args=(job.id, content, filename, publish),
        daemon=True,
        name=f"import-{job.id[:8]}",
    ).start()
    return ImportJobStart(job_id=job.id, status=job.status)


@router.get("/api/admin/import/jobs/{job_id}", response_model=ImportJobStatus)
def import_job_status(_: AdminUser, job_id: str):
    job = get_import_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    return ImportJobStatus(**job)


@router.post("/api/admin/import/outreach", response_model=OutreachResult)
def send_outreach_invites(_: AdminUser, db: Annotated[Session, Depends(get_db)], limit: int = 100):
    """Send claim-invite emails to imported centers that have outreach_email set."""
    centers = (
        db.query(RehabCenter)
        .filter(
            RehabCenter.outreach_email.isnot(None),
            RehabCenter.outreach_unsubscribed_at.is_(None),
            RehabCenter.claimed.is_(False),
            RehabCenter.deleted_at.is_(None),
        )
        .order_by(RehabCenter.id)
        .limit(min(limit, 500))
        .all()
    )
    sent = 0
    skipped = 0
    errors: list[str] = []
    for center in centers:
        email = (center.outreach_email or "").strip()
        if not email or "@" not in email:
            skipped += 1
            continue
        listing_url = f"{settings.public_site_url}/rehab-centers/{center.slug}"
        unsubscribe_token = create_action_token(str(center.id), "outreach_unsubscribe", expires_minutes=60 * 24 * 365 * 5)
        ok = send_email(
            db,
            to_email=email,
            template_key="outreach_invite",
            context={
                "center_name": center.name,
                "listing_url": listing_url,
                "claim_url": listing_url,
                "unsubscribe_url": f"{settings.public_site_url}/unsubscribe?token={unsubscribe_token}",
            },
            rehab_center_id=center.id,
        )
        if ok:
            sent += 1
        else:
            errors.append(f"{center.name}: send failed")
    return OutreachResult(sent=sent, skipped=skipped, errors=errors[:20])


@router.get("/api/outreach/unsubscribe")
def unsubscribe_outreach(token: str, db: Annotated[Session, Depends(get_db)]):
    payload = decode_token(token)
    if not payload or payload.get("type") != "action" or payload.get("action") != "outreach_unsubscribe":
        return {"message": "This unsubscribe link is invalid or expired."}
    center = db.query(RehabCenter).filter(RehabCenter.id == int(payload.get("sub", 0))).first()
    if not center:
        return {"message": "This unsubscribe link is invalid."}
    center.outreach_unsubscribed_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "You will no longer receive listing outreach emails."}
