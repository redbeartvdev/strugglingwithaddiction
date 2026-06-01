from datetime import datetime, timezone
from typing import Annotated
import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.api.rehab_helpers import center_to_public
from app.core.deps import AdminUser, ClientUser, CurrentUser, get_current_user_optional
from app.core.security import hash_password
from app.database import get_db
from app.models.profile import UserProfile
from app.models.rehab import (
    ClaimStatus,
    RehabCenter,
    RehabCenterClaim,
    ListingStatus,
    CenterSource,
    ScrapeJob,
    ScrapeJobStatus,
)
from app.models.scrape_saved import ScrapeSavedItem
from app.models.user import User, UserRole
from app.schemas.rehab import (
    ClaimAdmin,
    ClaimedClientAdmin,
    ClaimCreate,
    ClaimOut,
    ClaimReview,
    ClaimStatusPublic,
    RehabCenterAdmin,
    RehabCenterCreate,
    RehabCenterPublic,
    RehabCenterUpdate,
    ScrapeJobOut,
    ScrapeRequest,
    ScrapeResultItem,
    ScrapeSavedOut,
    ScrapeSettingsOut,
    ScrapeSettingsUpdate,
)
from app.services.tickets import generate_claim_ticket
from app.services.scrape_settings import get_scrape_settings, mask_api_key
from app.services.scraper import run_scrape_job, result_to_center_fields

router = APIRouter(tags=["rehab"])


@router.get("/api/rehab-centers", response_model=list[RehabCenterPublic])
def list_centers(db: Annotated[Session, Depends(get_db)]):
    centers = (
        db.query(RehabCenter)
        .filter(RehabCenter.listing_status == ListingStatus.published, RehabCenter.deleted_at.is_(None))
        .order_by(RehabCenter.name)
        .all()
    )
    return [center_to_public(db, c) for c in centers]


@router.get("/api/rehab-centers/{slug}", response_model=RehabCenterPublic)
def get_center(slug: str, db: Annotated[Session, Depends(get_db)]):
    center = db.query(RehabCenter).filter(
        RehabCenter.slug == slug,
        RehabCenter.listing_status == ListingStatus.published,
        RehabCenter.deleted_at.is_(None),
    ).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    return center_to_public(db, center)


@router.post("/api/rehab/claims", response_model=ClaimOut)
def submit_claim(body: ClaimCreate, db: Annotated[Session, Depends(get_db)], user: Annotated[User | None, Depends(get_current_user_optional)]):
    center = db.query(RehabCenter).filter(RehabCenter.id == body.rehab_center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    if center.claimed:
        raise HTTPException(status_code=400, detail="Center already claimed")
    ticket = generate_claim_ticket(db)
    claim = RehabCenterClaim(
        ticket_number=ticket,
        rehab_center_id=center.id,
        submitter_user_id=user.id if user else None,
        full_name=body.full_name,
        job_title=body.job_title,
        work_email=body.work_email.lower(),
        phone=body.phone,
        affiliation_text=body.affiliation_text,
        facility_role=body.facility_role,
        business_license_url=body.business_license_url,
        proof_of_affiliation_url=body.proof_of_affiliation_url,
        status=ClaimStatus.pending,
    )
    db.add(claim)
    db.commit()
    return ClaimOut(
        ticket_number=ticket,
        status=ClaimStatus.pending,
        center_name=center.name,
        message="Your claim has been submitted. Save your ticket number for status updates.",
    )


@router.get("/api/rehab/claims/{ticket}", response_model=ClaimStatusPublic)
def claim_status(ticket: str, db: Annotated[Session, Depends(get_db)]):
    claim = (
        db.query(RehabCenterClaim)
        .options(joinedload(RehabCenterClaim.center))
        .filter(RehabCenterClaim.ticket_number == ticket.upper())
        .first()
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Ticket not found")
    messages = {
        ClaimStatus.pending: "Your claim is pending review.",
        ClaimStatus.under_review: "Your claim is under review.",
        ClaimStatus.approved: "Approved! Register and complete membership to activate your listing.",
        ClaimStatus.rejected: "Your claim was not approved. Contact support for details.",
    }
    return ClaimStatusPublic(
        ticket_number=claim.ticket_number,
        status=claim.status,
        center_name=claim.center.name,
        submitted_at=claim.created_at,
        reviewed_at=claim.reviewed_at,
        message=messages.get(claim.status, ""),
    )


@router.get("/api/admin/rehab-centers", response_model=list[RehabCenterAdmin])
def admin_list_centers(_: AdminUser, db: Annotated[Session, Depends(get_db)], trash: bool = Query(False)):
    from app.services.storage import resolve_image_url
    q = db.query(RehabCenter)
    q = q.filter(RehabCenter.deleted_at.isnot(None) if trash else RehabCenter.deleted_at.is_(None))
    centers = q.order_by(RehabCenter.updated_at.desc()).all()
    result = []
    for c in centers:
        item = RehabCenterAdmin.model_validate(c)
        item.image_url = resolve_image_url(c.image_key)
        result.append(item)
    return result


@router.get("/api/admin/rehab-centers/{center_id}", response_model=RehabCenterAdmin)
def admin_get_center(center_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    from app.services.storage import resolve_image_url
    center = db.query(RehabCenter).filter(RehabCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    item = RehabCenterAdmin.model_validate(center)
    item.image_url = resolve_image_url(center.image_key)
    return item


@router.post("/api/admin/rehab-centers", response_model=RehabCenterAdmin, status_code=201)
def create_center(body: RehabCenterCreate, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    if db.query(RehabCenter).filter(RehabCenter.slug == body.slug).first():
        raise HTTPException(status_code=400, detail="Slug exists")
    center = RehabCenter(**body.model_dump())
    if center.listing_status == ListingStatus.published and not center.published_at:
        center.published_at = body.published_at or datetime.now(timezone.utc)
    db.add(center)
    db.commit()
    db.refresh(center)
    out = RehabCenterAdmin.model_validate(center)
    return out


@router.patch("/api/admin/rehab-centers/{center_id}", response_model=RehabCenterAdmin)
def update_center(center_id: int, body: RehabCenterUpdate, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    center = db.query(RehabCenter).filter(RehabCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(center, k, v)
    if body.listing_status == ListingStatus.published and center.published_at is None:
        center.published_at = body.published_at if body.published_at is not None else datetime.now(timezone.utc)
    db.commit()
    db.refresh(center)
    return RehabCenterAdmin.model_validate(center)


@router.delete("/api/admin/rehab-centers/{center_id}", status_code=204)
def trash_center(center_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    center = db.query(RehabCenter).filter(RehabCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    if center.deleted_at:
        raise HTTPException(status_code=400, detail="Already in trash")
    center.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/api/admin/rehab-centers/{center_id}/restore", response_model=RehabCenterAdmin)
def restore_center(center_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    center = db.query(RehabCenter).filter(RehabCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    center.deleted_at = None
    db.commit()
    db.refresh(center)
    return RehabCenterAdmin.model_validate(center)


@router.delete("/api/admin/rehab-centers/{center_id}/permanent", status_code=204)
def permanent_delete_center(center_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    center = db.query(RehabCenter).filter(RehabCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    if not center.deleted_at:
        raise HTTPException(status_code=400, detail="Move to trash first")
    db.delete(center)
    db.commit()


@router.get("/api/admin/claims", response_model=list[ClaimAdmin])
def list_claims(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    claims = db.query(RehabCenterClaim).options(joinedload(RehabCenterClaim.center)).order_by(RehabCenterClaim.created_at.desc()).all()
    return [
        ClaimAdmin(
            id=c.id,
            ticket_number=c.ticket_number,
            rehab_center_id=c.rehab_center_id,
            center_name=c.center.name,
            status=c.status,
            full_name=c.full_name,
            job_title=c.job_title,
            work_email=c.work_email,
            phone=c.phone,
            affiliation_text=c.affiliation_text,
            facility_role=c.facility_role,
            admin_notes=c.admin_notes,
            created_at=c.created_at,
            reviewed_at=c.reviewed_at,
        )
        for c in claims
    ]


@router.get("/api/admin/claimed-clients", response_model=list[ClaimedClientAdmin])
def list_claimed_clients(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    centers = (
        db.query(RehabCenter)
        .filter(RehabCenter.claimed.is_(True), RehabCenter.deleted_at.is_(None))
        .order_by(RehabCenter.updated_at.desc())
        .all()
    )
    result: list[ClaimedClientAdmin] = []
    for center in centers:
        approved = (
            db.query(RehabCenterClaim)
            .filter(
                RehabCenterClaim.rehab_center_id == center.id,
                RehabCenterClaim.status == ClaimStatus.approved,
            )
            .order_by(RehabCenterClaim.reviewed_at.desc())
            .first()
        )
        owner = db.query(User).filter(User.id == center.owner_user_id).first() if center.owner_user_id else None
        profile = db.query(UserProfile).filter(UserProfile.user_id == owner.id).first() if owner else None
        result.append(
            ClaimedClientAdmin(
                rehab_center_id=center.id,
                center_name=center.name,
                location_display=center.location_display or "",
                listing_status=center.listing_status,
                client_user_id=owner.id if owner else None,
                client_name=(profile.display_name if profile else None) or (approved.full_name if approved else None),
                client_email=owner.email if owner else (approved.work_email if approved else None),
                client_active=owner.is_active if owner else None,
                ticket_number=approved.ticket_number if approved else None,
                job_title=approved.job_title if approved else None,
                phone=approved.phone if approved else center.phone,
                claimed_at=(approved.reviewed_at if approved else center.updated_at),
            )
        )
    return result


@router.patch("/api/admin/claims/{claim_id}", response_model=ClaimAdmin)
def review_claim(claim_id: int, body: ClaimReview, admin: AdminUser, db: Annotated[Session, Depends(get_db)]):
    claim = db.query(RehabCenterClaim).options(joinedload(RehabCenterClaim.center)).filter(RehabCenterClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    claim.status = body.status
    claim.admin_notes = body.admin_notes
    claim.reviewed_by_id = admin.id
    claim.reviewed_at = datetime.now(timezone.utc)
    center = claim.center
    if body.status == ClaimStatus.approved:
        center.claimed = True
        if body.create_client_user and body.client_password:
            email = claim.work_email.lower()
            user = db.query(User).filter(User.email == email).first()
            if not user:
                user = User(
                    email=email,
                    password_hash=hash_password(body.client_password),
                    role=UserRole.client,
                    is_active=False,
                )
                db.add(user)
                db.flush()
                db.add(UserProfile(user_id=user.id, display_name=claim.full_name, slug=f"center-{center.id}-{user.id}"))
            center.owner_user_id = user.id
            claim.submitter_user_id = user.id
    elif body.status == ClaimStatus.rejected:
        pass
    db.commit()
    db.refresh(claim)
    return ClaimAdmin(
        id=claim.id,
        ticket_number=claim.ticket_number,
        rehab_center_id=claim.rehab_center_id,
        center_name=center.name,
        status=claim.status,
        full_name=claim.full_name,
        job_title=claim.job_title,
        work_email=claim.work_email,
        phone=claim.phone,
        affiliation_text=claim.affiliation_text,
        facility_role=claim.facility_role,
        admin_notes=claim.admin_notes,
        created_at=claim.created_at,
        reviewed_at=claim.reviewed_at,
    )


@router.get("/api/client/my-center", response_model=RehabCenterAdmin | None)
def client_my_center(user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    center = db.query(RehabCenter).filter(RehabCenter.owner_user_id == user.id).first()
    if not center:
        return None
    return RehabCenterAdmin.model_validate(center)


@router.post("/api/admin/scrape", response_model=ScrapeJobOut, status_code=202)
def trigger_scrape(
    body: ScrapeRequest,
    background_tasks: BackgroundTasks,
    admin: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    query = body.url or body.query or f"rehab centers in {body.state}"
    job = ScrapeJob(
        query_or_url=query,
        state=body.state,
        status=ScrapeJobStatus.pending,
        created_by_id=admin.id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(run_scrape_job, job.id, body.offset)
    return _scrape_job_out(job)


def _parse_job_results(job: ScrapeJob) -> list[ScrapeResultItem]:
    if not job.results_json:
        return []
    try:
        raw = json.loads(job.results_json)
        return [ScrapeResultItem.model_validate(item) for item in raw]
    except Exception:
        return []


def _scrape_job_out(job: ScrapeJob) -> ScrapeJobOut:
    return ScrapeJobOut(
        id=job.id,
        status=job.status,
        query_or_url=job.query_or_url,
        state=job.state,
        results_count=job.results_count,
        results=_parse_job_results(job),
        error_log=job.error_log,
        created_at=job.created_at,
    )


@router.get("/api/admin/scrape/{job_id}", response_model=ScrapeJobOut)
def get_scrape_job(job_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    job = db.query(ScrapeJob).filter(ScrapeJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _scrape_job_out(job)


def _unique_slug(db: Session, base_slug: str) -> str:
    slug = base_slug
    n = 1
    while db.query(RehabCenter).filter(RehabCenter.slug == slug).first():
        slug = f"{base_slug}-{n}"
        n += 1
    return slug


def _create_center_from_item(db: Session, item: dict) -> RehabCenter:
    fields = result_to_center_fields(item)
    fields["slug"] = _unique_slug(db, fields["slug"])
    fields["source"] = CenterSource.scraped
    fields["listing_status"] = ListingStatus.draft
    center = RehabCenter(**fields)
    db.add(center)
    db.commit()
    db.refresh(center)
    return center


@router.post("/api/admin/scrape/{job_id}/add/{index}", response_model=RehabCenterAdmin)
def add_scrape_result(job_id: int, index: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    job = db.query(ScrapeJob).filter(ScrapeJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    results = _parse_job_results(job)
    if index < 0 or index >= len(results):
        raise HTTPException(status_code=404, detail="Result not found")
    center = _create_center_from_item(db, results[index].model_dump())
    return RehabCenterAdmin.model_validate(center)


@router.post("/api/admin/scrape/{job_id}/save/{index}", response_model=ScrapeSavedOut)
def save_scrape_result(job_id: int, index: int, admin: AdminUser, db: Annotated[Session, Depends(get_db)]):
    job = db.query(ScrapeJob).filter(ScrapeJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    results = _parse_job_results(job)
    if index < 0 or index >= len(results):
        raise HTTPException(status_code=404, detail="Result not found")
    r = results[index]
    item = ScrapeSavedItem(
        name=r.name,
        address=r.address,
        rating=r.rating,
        services=r.services,
        phone=r.phone,
        description=r.description,
        website=r.website,
        source_url=r.source_url,
        state=r.state or job.state,
        created_by_id=admin.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ScrapeSavedOut.model_validate(item)


@router.get("/api/admin/scrape/saved/list", response_model=list[ScrapeSavedOut])
def list_saved(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    items = db.query(ScrapeSavedItem).order_by(ScrapeSavedItem.created_at.desc()).all()
    return [ScrapeSavedOut.model_validate(i) for i in items]


@router.delete("/api/admin/scrape/saved/{item_id}", status_code=204)
def delete_saved(item_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    item = db.query(ScrapeSavedItem).filter(ScrapeSavedItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()


@router.post("/api/admin/scrape/saved/{item_id}/add", response_model=RehabCenterAdmin)
def add_saved_to_rehab(item_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    item = db.query(ScrapeSavedItem).filter(ScrapeSavedItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    data = {
        "name": item.name,
        "address": item.address,
        "rating": float(item.rating) if item.rating else 4.0,
        "services": item.services or [],
        "phone": item.phone,
        "description": item.description,
        "website": item.website,
        "source_url": item.source_url,
        "state": item.state,
    }
    center = _create_center_from_item(db, data)
    return RehabCenterAdmin.model_validate(center)


@router.get("/api/admin/scrape-settings", response_model=ScrapeSettingsOut)
def get_scrape_settings_api(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    s = get_scrape_settings(db)
    return ScrapeSettingsOut(
        openai_api_key_set=bool(s.openai_api_key),
        kimi_api_key_set=bool(s.kimi_api_key),
        claude_api_key_set=bool(s.claude_api_key),
        gemini_api_key_set=bool(s.gemini_api_key),
        openai_api_key_masked=mask_api_key(s.openai_api_key),
        kimi_api_key_masked=mask_api_key(s.kimi_api_key),
        claude_api_key_masked=mask_api_key(s.claude_api_key),
        gemini_api_key_masked=mask_api_key(s.gemini_api_key),
        preferred_provider=s.preferred_provider,
    )


@router.patch("/api/admin/scrape-settings", response_model=ScrapeSettingsOut)
def update_scrape_settings(body: ScrapeSettingsUpdate, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    s = get_scrape_settings(db)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        if k.endswith("_api_key") and v == "":
            v = None
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return ScrapeSettingsOut(
        openai_api_key_set=bool(s.openai_api_key),
        kimi_api_key_set=bool(s.kimi_api_key),
        claude_api_key_set=bool(s.claude_api_key),
        gemini_api_key_set=bool(s.gemini_api_key),
        openai_api_key_masked=mask_api_key(s.openai_api_key),
        kimi_api_key_masked=mask_api_key(s.kimi_api_key),
        claude_api_key_masked=mask_api_key(s.claude_api_key),
        gemini_api_key_masked=mask_api_key(s.gemini_api_key),
        preferred_provider=s.preferred_provider,
    )
