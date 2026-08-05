"""Claim → verify → subscribe journey endpoints."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import secrets
from typing import Annotated
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.core.security import create_action_token, hash_password, verify_password
from app.database import get_db
from app.models.billing import BillingInterval, Subscription
from app.models.profile import UserProfile
from app.models.rehab import ClaimStatus, FacilityRole, RehabCenter, RehabCenterClaim
from app.models.user import User, UserRole
from app.schemas.rehab import ClaimOut, ClaimStatusPublic
from app.services.email import resolve_email_delivery, send_email
from app.services.phone import send_callback_code
from app.services.storage import get_public_url, upload_file
from app.services.tickets import generate_claim_ticket

router = APIRouter(tags=["claim-journey"])
settings = get_settings()


class ClaimStartRequest(BaseModel):
    rehab_center_id: int
    full_name: str
    work_email: EmailStr
    password: str = Field(min_length=8)
    phone: str | None = None
    job_title: str = ""
    facility_role: FacilityRole = FacilityRole.other
    affiliation_text: str = ""


class ClaimStartOut(BaseModel):
    ticket_number: str
    status: ClaimStatus
    center_name: str
    message: str
    checkout_ready: bool = False
    user_id: int | None = None


class CheckoutClaimRequest(BaseModel):
    ticket_number: str
    interval: str = "month"


class PhoneCallbackVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


def _email_domain(email: str) -> str | None:
    parts = email.lower().split("@")
    return parts[1] if len(parts) == 2 else None


def _website_domain(website: str | None) -> str | None:
    if not website:
        return None
    raw = website.strip()
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    try:
        host = urlparse(raw).hostname or ""
    except Exception:
        return None
    host = host.lower()
    if host.startswith("www."):
        host = host[4:]
    return host or None


def _domain_match(work_email: str, website: str | None) -> bool:
    ed = _email_domain(work_email)
    wd = _website_domain(website)
    if not ed or not wd:
        return False
    return ed == wd or ed.endswith("." + wd) or wd.endswith("." + ed)


@router.post("/api/rehab/claims/start", response_model=ClaimStartOut)
def start_claim(body: ClaimStartRequest, db: Annotated[Session, Depends(get_db)]):
    center = db.query(RehabCenter).filter(RehabCenter.id == body.rehab_center_id, RehabCenter.deleted_at.is_(None)).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    if center.claimed and center_has_paid_access(db, center):
        raise HTTPException(status_code=400, detail="Center already claimed")

    email = body.work_email.lower()
    user = db.query(User).filter(User.email == email).first()
    if user and user.role != UserRole.client:
        raise HTTPException(status_code=400, detail="Email is already registered")
    if not user:
        user = User(
            email=email,
            password_hash=hash_password(body.password),
            role=UserRole.client,
            is_active=False,
        )
        db.add(user)
        db.flush()
        db.add(UserProfile(user_id=user.id, display_name=body.full_name, slug=f"client-{user.id}"))
    else:
        # Allow restarting claim with same email; refresh password for inactive accounts
        if not user.is_active:
            user.password_hash = hash_password(body.password)

    ticket = generate_claim_ticket(db)
    matched = _domain_match(email, center.website)
    claim = RehabCenterClaim(
        ticket_number=ticket,
        rehab_center_id=center.id,
        submitter_user_id=user.id,
        full_name=body.full_name,
        job_title=body.job_title or "",
        work_email=email,
        phone=body.phone,
        affiliation_text=body.affiliation_text or "",
        facility_role=body.facility_role,
        email_domain_matched=matched,
        status=ClaimStatus.pending,
    )
    db.add(claim)
    db.commit()

    listing_url = f"{settings.public_site_url}/rehab-centers"
    claim_url = f"{settings.public_site_url}/claim-status/{ticket}"
    ops = resolve_email_delivery(db)["ops_email"]
    send_email(
        db,
        to_email=ops,
        template_key="admin_new_claim",
        context={
            "name": body.full_name,
            "email": email,
            "lead_phone": body.phone or "",
            "center_name": center.name,
            "ticket": ticket,
            "claim_url": claim_url,
            "admin_claims_url": f"{settings.admin_site_url}/admin/claims",
        },
        rehab_center_id=center.id,
    )
    send_email(
        db,
        to_email=email,
        template_key="account_created",
        context={
            "name": body.full_name,
            "email": email,
            "login_url": f"{settings.public_site_url.rstrip('/')}/portal",
            "claim_for": f" to manage {center.name}",
            "center_name": center.name,
        },
        user_id=user.id,
        rehab_center_id=center.id,
    )
    send_email(
        db,
        to_email=email,
        template_key="verification",
        context={"name": body.full_name, "center_name": center.name, "ticket": ticket, "claim_url": claim_url, "listing_url": listing_url},
        user_id=user.id,
        rehab_center_id=center.id,
    )
    send_email(
        db,
        to_email=email,
        template_key="email_confirmation",
        context={
            "name": body.full_name,
            "confirmation_url": f"{settings.admin_site_url}/confirm-email?token={create_action_token(email, 'email_confirmation')}",
        },
        user_id=user.id,
        rehab_center_id=center.id,
    )

    return ClaimStartOut(
        ticket_number=ticket,
        status=ClaimStatus.pending,
        center_name=center.name,
        message="Account created. Choose a monthly or yearly plan to continue — then upload certification for verification.",
        checkout_ready=True,
        user_id=user.id,
    )


@router.post("/api/rehab/claims/{ticket}/cert", response_model=ClaimStartOut)
async def upload_claim_cert(
    ticket: str,
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
):
    claim = (
        db.query(RehabCenterClaim)
        .options(joinedload(RehabCenterClaim.center))
        .filter(RehabCenterClaim.ticket_number == ticket.upper())
        .first()
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if claim.status in (ClaimStatus.rejected, ClaimStatus.abandoned):
        raise HTTPException(status_code=400, detail="Claim is closed")
    if not claim.payment_received_at:
        raise HTTPException(
            status_code=400,
            detail="Subscribe first — payment is required before uploading certification.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    key = upload_file(content, file.filename or "cert.pdf", file.content_type or "application/pdf")
    claim.business_license_url = get_public_url(key)
    if claim.status == ClaimStatus.pending:
        claim.status = ClaimStatus.under_review
    db.commit()

    ops = resolve_email_delivery(db)["ops_email"]
    send_email(
        db,
        to_email=ops,
        template_key="claim_under_review_admin",
        context={
            "name": claim.full_name,
            "email": claim.work_email,
            "center_name": claim.center.name if claim.center else "center",
            "ticket": claim.ticket_number,
            "admin_claims_url": f"{settings.admin_site_url}/admin/claims",
        },
        user_id=claim.submitter_user_id,
        rehab_center_id=claim.rehab_center_id,
    )
    center_name = claim.center.name if claim.center else "your center"
    claim_url = f"{settings.public_site_url}/claim-status/{claim.ticket_number}"
    send_email(
        db,
        to_email=claim.work_email,
        template_key="claim_submitted",
        context={
            "name": claim.full_name,
            "center_name": center_name,
            "ticket": claim.ticket_number,
            "claim_url": claim_url,
        },
        user_id=claim.submitter_user_id,
        rehab_center_id=claim.rehab_center_id,
    )

    return ClaimStartOut(
        ticket_number=claim.ticket_number,
        status=claim.status,
        center_name=claim.center.name,
        message="Proof received. Your claim is pending admin verification — we emailed you a confirmation.",
        checkout_ready=False,
        user_id=claim.submitter_user_id,
    )


def _claim_by_ticket(ticket: str, db: Session) -> RehabCenterClaim:
    claim = (
        db.query(RehabCenterClaim)
        .options(joinedload(RehabCenterClaim.center))
        .filter(RehabCenterClaim.ticket_number == ticket.upper())
        .first()
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if claim.status in (ClaimStatus.rejected, ClaimStatus.abandoned):
        raise HTTPException(status_code=400, detail="Claim is closed")
    return claim


@router.post("/api/rehab/claims/{ticket}/phone/send")
def send_phone_callback(ticket: str, db: Annotated[Session, Depends(get_db)]):
    claim = _claim_by_ticket(ticket, db)
    center_phone = claim.center.phone
    if not center_phone:
        raise HTTPException(status_code=400, detail="This SAMHSA listing has no facility phone number for callback verification")
    code = f"{secrets.randbelow(1_000_000):06d}"
    claim.phone_otp_hash = hash_password(code)
    claim.phone_otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    send_callback_code(center_phone, code)
    send_email(
        db,
        to_email=claim.work_email,
        template_key="phone_callback_code",
        context={
            "name": claim.full_name,
            "center_name": claim.center.name if claim.center else "your center",
            "otp_code": code,
            "claim_url": f"{settings.public_site_url}/claim-status/{claim.ticket_number}",
        },
        user_id=claim.submitter_user_id,
        rehab_center_id=claim.rehab_center_id,
    )
    db.commit()
    return {"message": "A confirmation code was sent to the facility phone number on this listing.", "expires_in_minutes": 15}


@router.post("/api/rehab/claims/{ticket}/phone/verify")
def verify_phone_callback(
    ticket: str,
    body: PhoneCallbackVerifyRequest,
    db: Annotated[Session, Depends(get_db)],
):
    claim = _claim_by_ticket(ticket, db)
    if not claim.phone_otp_hash or not claim.phone_otp_expires_at:
        raise HTTPException(status_code=400, detail="Send a callback code first")
    if claim.phone_otp_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Confirmation code expired. Send a new code.")
    if not verify_password(body.code, claim.phone_otp_hash):
        raise HTTPException(status_code=400, detail="Incorrect confirmation code")
    claim.phone_verified_at = datetime.now(timezone.utc)
    claim.phone_otp_hash = None
    claim.phone_otp_expires_at = None
    db.commit()
    return {"message": "Facility phone verified.", "phone_verified": True}


def center_has_paid_access(db: Session, center: RehabCenter) -> bool:
    if not center.owner_user_id:
        return False
    sub = db.query(Subscription).filter(Subscription.user_id == center.owner_user_id).first()
    return bool(sub and sub.status in ("active", "trialing"))


@router.post("/api/billing/checkout-claim")
def checkout_claim(body: CheckoutClaimRequest, db: Annotated[Session, Depends(get_db)]):
    from app.services.stripe_config import init_stripe_sdk, resolve_stripe_config

    st = init_stripe_sdk(db)
    if not st:
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured. Ask an admin to connect Stripe in Finance settings.",
        )
    claim = (
        db.query(RehabCenterClaim)
        .options(joinedload(RehabCenterClaim.center))
        .filter(RehabCenterClaim.ticket_number == body.ticket_number.upper())
        .first()
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if claim.status in (ClaimStatus.rejected, ClaimStatus.abandoned, ClaimStatus.approved):
        raise HTTPException(status_code=400, detail="This claim cannot accept a new subscription")
    if claim.payment_received_at:
        # Already paid — allow re-checkout only if sub is not active
        sub_existing = db.query(Subscription).filter(Subscription.user_id == claim.submitter_user_id).first()
        if sub_existing and sub_existing.status in ("active", "trialing", "past_due"):
            raise HTTPException(status_code=400, detail="Subscription already active for this claim")
    if not claim.submitter_user_id:
        raise HTTPException(status_code=400, detail="Claim has no user account")

    user = db.query(User).filter(User.id == claim.submitter_user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User missing")

    from app.models.billing import SubscriptionPlan
    from app.api.billing import _price_for_interval

    sub_row = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    if not sub_row or not sub_row.stripe_customer_id:
        customer = st.Customer.create(email=user.email, name=claim.full_name, metadata={"user_id": str(user.id)})
        if not sub_row:
            sub_row = Subscription(user_id=user.id, stripe_customer_id=customer.id, status="pending")
            db.add(sub_row)
        else:
            sub_row.stripe_customer_id = customer.id
        db.commit()

    interval = BillingInterval.year if body.interval == "year" else BillingInterval.month
    price_id = _price_for_interval(db, interval)
    if not price_id:
        raise HTTPException(
            status_code=503,
            detail="Stripe price not configured. Set monthly/yearly price IDs in Finance settings.",
        )

    session = st.checkout.Session.create(
        customer=sub_row.stripe_customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.public_site_url}/claim-status/{claim.ticket_number}?paid=1",
        cancel_url=f"{settings.public_site_url}/claim-status/{claim.ticket_number}?canceled=1",
        metadata={
            "user_id": str(user.id),
            "claim_ticket": claim.ticket_number,
            "rehab_center_id": str(claim.rehab_center_id),
        },
        subscription_data={"metadata": {"user_id": str(user.id), "claim_ticket": claim.ticket_number}},
    )
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.is_active.is_(True)).first()
    sub_row.plan_id = plan.id if plan else None
    sub_row.interval = interval
    db.commit()
    return {"checkout_url": session.url}


def _claim_status_message(claim: RehabCenterClaim) -> str:
    paid = bool(claim.payment_received_at)
    if claim.status == ClaimStatus.pending:
        if not paid:
            return "Choose a monthly or yearly plan to continue. After payment, upload your rehab certification."
        return "Payment received. Upload your rehab certification to continue verification."
    if claim.status == ClaimStatus.under_review:
        return "Your claim is submitted and waiting for admin verification. We will email you when verification is complete."
    if claim.status == ClaimStatus.certified:
        if paid:
            return "Verified and paid — your listing is being activated."
        return "Verified — complete payment to unlock your listing (legacy path)."
    if claim.status == ClaimStatus.approved:
        return "Claimed and active. Log in to manage your listing."
    if claim.status == ClaimStatus.rejected:
        return "Your claim was not approved."
    if claim.status == ClaimStatus.abandoned:
        return "This claim expired. Start again from the listing page."
    return ""


@router.get("/api/rehab/claims/{ticket}/detail", response_model=ClaimStatusPublic)
def claim_status_detail(ticket: str, db: Annotated[Session, Depends(get_db)]):
    claim = (
        db.query(RehabCenterClaim)
        .options(joinedload(RehabCenterClaim.center))
        .filter(RehabCenterClaim.ticket_number == ticket.upper())
        .first()
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Ticket not found")
    paid = bool(claim.payment_received_at)
    return ClaimStatusPublic(
        ticket_number=claim.ticket_number,
        status=claim.status,
        center_name=claim.center.name,
        submitted_at=claim.created_at,
        reviewed_at=claim.reviewed_at,
        message=_claim_status_message(claim),
        certification_uploaded=bool(claim.business_license_url),
        email_domain_matched=bool(claim.email_domain_matched),
        phone_verified=bool(claim.phone_verified_at),
        payment_received=paid,
        checkout_ready=not paid and claim.status in (ClaimStatus.pending, ClaimStatus.under_review, ClaimStatus.certified),
    )


def record_payment_on_claim(
    db: Session,
    *,
    user_id: int,
    claim_ticket: str | None = None,
    rehab_center_id: int | None = None,
) -> None:
    """Called from Stripe webhook after checkout — activates user, records payment, keeps listing locked until certify."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return
    user.is_active = True
    claim = None
    if claim_ticket:
        claim = db.query(RehabCenterClaim).filter(RehabCenterClaim.ticket_number == claim_ticket.upper()).first()
    if not claim:
        claim = (
            db.query(RehabCenterClaim)
            .filter(RehabCenterClaim.submitter_user_id == user_id)
            .order_by(RehabCenterClaim.created_at.desc())
            .first()
        )
    now = datetime.now(timezone.utc)
    center = None
    if claim:
        claim.payment_received_at = claim.payment_received_at or now
        # Reserve ownership; listing unlocks only after admin certifies
        center = db.query(RehabCenter).filter(RehabCenter.id == claim.rehab_center_id).first()
        if center:
            center.owner_user_id = user_id
            center.claimed = False
            center.contact_visible = False
        # If already certified (legacy verify-then-pay), unlock now
        if claim.status == ClaimStatus.certified:
            grant_listing_after_verify(db, claim=claim, user=user)
            return
    elif rehab_center_id:
        center = db.query(RehabCenter).filter(RehabCenter.id == rehab_center_id).first()
        if center:
            center.owner_user_id = user_id


def grant_listing_after_verify(
    db: Session,
    *,
    claim: RehabCenterClaim,
    user: User | None = None,
    send_welcome: bool = True,
) -> None:
    """Unlock listing after admin certifies a paid claim (or legacy certified+pay)."""
    if not user and claim.submitter_user_id:
        user = db.query(User).filter(User.id == claim.submitter_user_id).first()
    if not user:
        return
    user.is_active = True
    claim.status = ClaimStatus.approved
    claim.reviewed_at = claim.reviewed_at or datetime.now(timezone.utc)
    center = db.query(RehabCenter).filter(RehabCenter.id == claim.rehab_center_id).first()
    if not center:
        return
    newly_claimed = not center.claimed
    center.claimed = True
    center.contact_visible = True
    center.owner_user_id = user.id
    if claim.cert_verified_at:
        center.cert_verified_at = claim.cert_verified_at
    if newly_claimed and send_welcome:
        send_email(
            db,
            to_email=user.email,
            template_key="welcome",
            context={
                "name": claim.full_name if claim else user.email,
                "center_name": center.name,
                "login_url": f"{settings.public_site_url.rstrip('/')}/portal",
                "billing_url": f"{settings.admin_site_url}/client/billing",
                "receipt_url": f"{settings.admin_site_url}/client/billing",
            },
            user_id=user.id,
            rehab_center_id=center.id,
        )


def grant_claim_on_payment(db: Session, *, user_id: int, claim_ticket: str | None = None, rehab_center_id: int | None = None) -> None:
    """Backward-compatible alias — pay-first flow uses record_payment_on_claim."""
    record_payment_on_claim(db, user_id=user_id, claim_ticket=claim_ticket, rehab_center_id=rehab_center_id)


def cancel_and_refund_claim_subscription(db: Session, claim: RehabCenterClaim) -> dict:
    """Cancel Stripe subscription and refund latest charge when a paid claim is rejected."""
    from app.services.stripe_config import init_stripe_sdk

    result = {"canceled": False, "refunded": False, "error": None}
    if not claim.submitter_user_id:
        return result
    sub = db.query(Subscription).filter(Subscription.user_id == claim.submitter_user_id).first()
    if not sub:
        return result
    st = init_stripe_sdk(db)
    if not st:
        result["error"] = "Stripe not configured"
        return result
    try:
        if sub.stripe_subscription_id:
            st.Subscription.cancel(sub.stripe_subscription_id)
            result["canceled"] = True
        if sub.stripe_customer_id:
            charges = st.Charge.list(customer=sub.stripe_customer_id, limit=5)
            for ch in charges.data:
                if ch.paid and not ch.refunded:
                    st.Refund.create(charge=ch.id)
                    result["refunded"] = True
                    break
        sub.status = "canceled"
    except Exception as exc:  # noqa: BLE001
        result["error"] = str(exc)
    return result


def downgrade_center_after_cancel(db: Session, user_id: int, *, send_winback: bool = True) -> None:
    center = db.query(RehabCenter).filter(RehabCenter.owner_user_id == user_id).first()
    user = db.query(User).filter(User.id == user_id).first()
    if not center:
        return
    center.contact_visible = False
    # Keep owner link but publicly treat as basic (claim CTA returns via helpers)
    center.claimed = False
    center.verified_badge = False
    center.featured_until = None
    if user and send_winback:
        send_email(
            db,
            to_email=user.email,
            template_key="subscription_expired",
            context={
                "name": user.email,
                "center_name": center.name,
                "billing_url": f"{settings.admin_site_url}/client/billing",
            },
            user_id=user.id,
            rehab_center_id=center.id,
        )
        send_email(
            db,
            to_email=user.email,
            template_key="win_back",
            context={
                "name": user.email,
                "center_name": center.name,
                "billing_url": f"{settings.admin_site_url}/client/billing",
            },
            user_id=user.id,
            rehab_center_id=center.id,
        )


def schedule_abandon_reminder(db: Session, claim: RehabCenterClaim) -> None:
    """Backward-compatible wrapper — day-1/day-2 abandon emails + lead."""
    from app.services.abandonment import process_claim_abandonment

    process_claim_abandonment(db, claim)
