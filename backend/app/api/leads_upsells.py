"""Lead capture + client listing edit + upsells."""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.deps import ActiveSubscriber, AdminUser, ClientUser
from app.database import get_db
from app.models.billing import Subscription
from app.models.lead import CenterLead
from app.models.rehab import ClaimStatus, ListingStatus, RehabCenter, RehabCenterClaim
from app.models.upsell import UpsellFulfillment, UpsellOrder, UpsellOrderStatus, UpsellProductType
from app.models.user import User, UserRole
from app.schemas.rehab import RehabCenterAdmin
from app.services.email import send_email
from app.services.storage import get_public_url, resolve_image_url, upload_file

router = APIRouter(tags=["leads-upsells"])
settings = get_settings()


def _slugify_segment(value: str | None) -> str:
    import re

    text = re.sub(r"[^a-z0-9]+", "-", str(value or "").lower().strip())
    return text.strip("-")


def _public_listing_path(center: RehabCenter) -> str | None:
    state = center.state or (center.location_display or "").split(",")[-1].strip()
    city = center.city or (center.location_display or "").split(",")[0].strip()
    if not state or not city or not center.name:
        return None
    return (
        f"/rehabs/united-states/{_slugify_segment(state)}/"
        f"{_slugify_segment(city)}/{_slugify_segment(center.name)}"
    )


def _public_listing_url(center: RehabCenter) -> str | None:
    path = _public_listing_path(center)
    if not path:
        return None
    return f"{settings.public_site_url.rstrip('/')}{path}"


def _featured_active(center: RehabCenter) -> bool:
    return bool(center.featured_until and center.featured_until > datetime.now(timezone.utc))


def _upsell_status_for_center(db: Session, center: RehabCenter | None, product_type: UpsellProductType) -> dict:
    if not center:
        return {"owned": False, "status": "available", "order_status": None}
    orders = (
        db.query(UpsellOrder)
        .filter(
            UpsellOrder.rehab_center_id == center.id,
            UpsellOrder.product_type == product_type,
        )
        .order_by(UpsellOrder.created_at.desc())
        .all()
    )
    latest = orders[0] if orders else None
    if product_type == UpsellProductType.verified_badge and center.verified_badge:
        return {"owned": True, "status": "active", "order_status": latest.status.value if latest else "fulfilled"}
    if product_type == UpsellProductType.featured_placement and _featured_active(center):
        return {
            "owned": True,
            "status": "active",
            "order_status": latest.status.value if latest else "fulfilled",
            "featured_until": center.featured_until.isoformat() if center.featured_until else None,
        }
    if latest and latest.status in (UpsellOrderStatus.paid, UpsellOrderStatus.fulfilled):
        if product_type in (UpsellProductType.featured_article, UpsellProductType.article_aeo):
            return {
                "owned": latest.status == UpsellOrderStatus.fulfilled,
                "status": "fulfilled" if latest.status == UpsellOrderStatus.fulfilled else "in_progress",
                "order_status": latest.status.value,
            }
    if latest and latest.status == UpsellOrderStatus.pending:
        return {"owned": False, "status": "pending", "order_status": "pending"}
    return {"owned": False, "status": "available", "order_status": latest.status.value if latest else None}

UPSELL_CATALOG = [
    {
        "product_type": UpsellProductType.verified_badge,
        "label": "Verified / Accredited Badge",
        "price_label": "$199–$299 / yr",
        "amount_cents": 24900,
        "fulfillment": UpsellFulfillment.self_serve,
        "description": "Trust signal — makes verification mean something.",
    },
    {
        "product_type": UpsellProductType.featured_placement,
        "label": "Featured Placement",
        "price_label": "$249 / mo",
        "amount_cents": 24900,
        "fulfillment": UpsellFulfillment.self_serve,
        "description": "Category top placement + visual enhancement.",
    },
    {
        "product_type": UpsellProductType.featured_article,
        "label": "Featured Article",
        "price_label": "$950 once",
        "amount_cents": 95000,
        "fulfillment": UpsellFulfillment.human,
        "description": "Redbear-produced, SEO-optimized facility article.",
    },
    {
        "product_type": UpsellProductType.article_aeo,
        "label": "Article Syndication + AEO",
        "price_label": "$2,500 once",
        "amount_cents": 250000,
        "fulfillment": UpsellFulfillment.human,
        "description": "Article + distribution, internal linking, AI-search optimization.",
    },
]


class LeadCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: str | None = None
    message: str = ""
    source_url: str | None = None


class LeadReply(BaseModel):
    message: str = Field(min_length=1, max_length=5000)


class LeadOut(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str | None
    message: str
    source_url: str | None
    read_at: datetime | None
    created_at: datetime
    center_name: str | None = None

    model_config = {"from_attributes": True}


class ClientCenterUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    address_line: str | None = None
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    phone: str | None = None
    website: str | None = None
    contact_email: str | None = None
    google_maps_url: str | None = None
    google_reviews_url: str | None = None
    video_url: str | None = None
    specialties: list[str] | None = None
    insurances: list[str] | None = None
    levels_of_care: list[str] | None = None
    amenities: list[str] | None = None
    accreditations: list[str] | None = None
    testimonials: list[Any] | None = None
    gallery_keys: list[Any] | None = None


class UpsellCheckoutRequest(BaseModel):
    product_type: UpsellProductType


def _client_center(db: Session, user: User, *, heal: bool = True) -> RehabCenter | None:
    """Return the rehab listing owned by this client, healing common ownership desyncs."""
    center = (
        db.query(RehabCenter)
        .filter(RehabCenter.owner_user_id == user.id, RehabCenter.deleted_at.is_(None))
        .first()
    )
    if center or not heal or user.role != UserRole.client:
        return center

    email = (user.email or "").strip().lower()
    if email:
        by_email = (
            db.query(RehabCenter)
            .filter(
                RehabCenter.deleted_at.is_(None),
                RehabCenter.claimed.is_(True),
                RehabCenter.contact_email.isnot(None),
            )
            .all()
        )
        match = next(
            (c for c in by_email if (c.contact_email or "").strip().lower() == email),
            None,
        )
        if match and (match.owner_user_id is None or match.owner_user_id == user.id):
            if match.owner_user_id != user.id:
                match.owner_user_id = user.id
                match.contact_visible = True
                db.commit()
                db.refresh(match)
            return match

    claim = (
        db.query(RehabCenterClaim)
        .filter(
            RehabCenterClaim.submitter_user_id == user.id,
            RehabCenterClaim.status.in_((ClaimStatus.approved, ClaimStatus.certified)),
        )
        .order_by(RehabCenterClaim.created_at.desc())
        .first()
    )
    if claim:
        claimed_center = db.query(RehabCenter).filter(
            RehabCenter.id == claim.rehab_center_id,
            RehabCenter.deleted_at.is_(None),
        ).first()
        if claimed_center and (
            claimed_center.owner_user_id is None or claimed_center.owner_user_id == user.id
        ):
            changed = False
            if claimed_center.owner_user_id != user.id:
                claimed_center.owner_user_id = user.id
                changed = True
            if claim.status == ClaimStatus.approved:
                if not claimed_center.claimed:
                    claimed_center.claimed = True
                    changed = True
                if not claimed_center.contact_visible:
                    claimed_center.contact_visible = True
                    changed = True
            if changed:
                db.commit()
                db.refresh(claimed_center)
            return claimed_center

    return None


def _require_active_client_center(db: Session, user: User) -> RehabCenter:
    center = _client_center(db, user)
    if not center:
        raise HTTPException(status_code=404, detail="No center linked")
    sub = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    if not sub or sub.status not in ("active", "trialing", "past_due"):
        raise HTTPException(status_code=403, detail="Active subscription required to edit listing")
    return center


def _completeness(center: RehabCenter) -> dict:
    checks = [
        bool(center.name),
        bool(center.description and len(center.description) > 40),
        bool(center.address_line and center.city and center.state),
        bool(center.phone),
        bool(center.website),
        bool(center.contact_email),
        bool(center.specialties),
        bool(center.insurances),
        bool(center.levels_of_care),
        bool(center.amenities),
        bool(center.accreditations),
        bool(center.gallery_keys),
        bool(center.video_url),
        bool(center.google_maps_url),
        bool(center.testimonials),
    ]
    filled = sum(1 for c in checks if c)
    return {"filled": filled, "total": len(checks), "percent": int(round(100 * filled / len(checks)))}


@router.post("/api/rehab-centers/{slug}/leads", response_model=LeadOut)
def submit_lead(slug: str, body: LeadCreate, db: Annotated[Session, Depends(get_db)]):
    center = db.query(RehabCenter).filter(
        RehabCenter.slug == slug,
        RehabCenter.listing_status == ListingStatus.published,
        RehabCenter.deleted_at.is_(None),
    ).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    lead = CenterLead(
        rehab_center_id=center.id,
        full_name=body.full_name,
        email=body.email.lower(),
        phone=body.phone,
        message=body.message or "",
        source_url=body.source_url,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    notify = center.contact_email or center.outreach_email
    if center.owner_user_id:
        owner = db.query(User).filter(User.id == center.owner_user_id).first()
        if owner:
            notify = owner.email
    if notify:
        send_email(
            db,
            to_email=notify,
            template_key="new_lead_alert",
            context={
                "center_name": center.name,
                "lead_name": lead.full_name,
                "lead_email": lead.email,
                "lead_phone": lead.phone or "",
                "lead_message": lead.message,
                "source_url": lead.source_url or "",
                "inbox_url": f"{settings.admin_site_url}/client/leads",
            },
            user_id=center.owner_user_id,
            rehab_center_id=center.id,
        )

    return LeadOut(
        id=lead.id,
        full_name=lead.full_name,
        email=lead.email,
        phone=lead.phone,
        message=lead.message,
        source_url=lead.source_url,
        read_at=lead.read_at,
        created_at=lead.created_at,
        center_name=center.name,
    )


@router.get("/api/client/leads", response_model=list[LeadOut])
def list_client_leads(user: ActiveSubscriber, db: Annotated[Session, Depends(get_db)]):
    center = _client_center(db, user)
    if not center:
        return []
    leads = (
        db.query(CenterLead)
        .filter(CenterLead.rehab_center_id == center.id)
        .order_by(CenterLead.created_at.desc())
        .all()
    )
    return [
        LeadOut(
            id=l.id,
            full_name=l.full_name,
            email=l.email,
            phone=l.phone,
            message=l.message,
            source_url=l.source_url,
            read_at=l.read_at,
            created_at=l.created_at,
            center_name=center.name,
        )
        for l in leads
    ]


@router.patch("/api/client/leads/{lead_id}/read", response_model=LeadOut)
def mark_lead_read(lead_id: int, user: ActiveSubscriber, db: Annotated[Session, Depends(get_db)]):
    center = _client_center(db, user)
    if not center:
        raise HTTPException(status_code=404, detail="No center")
    lead = db.query(CenterLead).filter(CenterLead.id == lead_id, CenterLead.rehab_center_id == center.id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return LeadOut(
        id=lead.id,
        full_name=lead.full_name,
        email=lead.email,
        phone=lead.phone,
        message=lead.message,
        source_url=lead.source_url,
        read_at=lead.read_at,
        created_at=lead.created_at,
        center_name=center.name,
    )


@router.post("/api/client/leads/{lead_id}/reply")
def reply_to_lead(
    lead_id: int,
    body: LeadReply,
    user: ActiveSubscriber,
    db: Annotated[Session, Depends(get_db)],
):
    center = _require_active_client_center(db, user)
    lead = db.query(CenterLead).filter(CenterLead.id == lead_id, CenterLead.rehab_center_id == center.id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    send_email(
        db,
        to_email=lead.email,
        template_key="lead_reply",
        context={"lead_name": lead.full_name, "reply_message": body.message, "center_name": center.name},
        user_id=user.id,
        rehab_center_id=center.id,
    )
    lead.read_at = lead.read_at or datetime.now(timezone.utc)
    db.commit()
    return {"message": "Reply sent to the lead."}


@router.get("/api/client/leads/export")
def export_client_leads(user: ActiveSubscriber, db: Annotated[Session, Depends(get_db)]):
    center = _require_active_client_center(db, user)
    leads = (
        db.query(CenterLead)
        .filter(CenterLead.rehab_center_id == center.id)
        .order_by(CenterLead.created_at.desc())
        .all()
    )
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["full_name", "email", "phone", "message", "source_url", "created_at", "read_at"])
    for lead in leads:
        writer.writerow([lead.full_name, lead.email, lead.phone or "", lead.message, lead.source_url or "", lead.created_at, lead.read_at or ""])
    return StreamingResponse(
        iter([out.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="center-leads.csv"'},
    )


@router.patch("/api/client/my-center")
def update_my_center(body: ClientCenterUpdate, user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    center = _require_active_client_center(db, user)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(center, k, v)
    if any(k in data for k in ("city", "state", "address_line")):
        parts = [p for p in (center.city, center.state) if p]
        center.location_display = ", ".join(parts) or center.location_display
    if center.listing_status != ListingStatus.published:
        center.listing_status = ListingStatus.published
        center.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(center)

    send_email(
        db,
        to_email=user.email,
        template_key="profile_published",
        context={
            "name": user.email,
            "center_name": center.name,
            "listing_url": f"{settings.public_site_url}/rehab-centers",
        },
        user_id=user.id,
        rehab_center_id=center.id,
    )

    out = RehabCenterAdmin.model_validate(center).model_dump()
    out["completeness"] = _completeness(center)
    return out


@router.post("/api/client/my-center/hero")
async def upload_center_hero_image(
    user: ActiveSubscriber,
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
):
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Hero uploads must be images")
    content = await file.read()
    if not content or len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Hero image must be between 1 byte and 8MB")
    center = _require_active_client_center(db, user)
    key = upload_file(content, file.filename or "hero.jpg", file.content_type or "image/jpeg")
    center.image_key = key
    db.commit()
    return {"image_key": key, "image_url": resolve_image_url(key)}


@router.post("/api/client/my-center/gallery")
async def upload_center_gallery_image(
    user: ActiveSubscriber,
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
):
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Gallery uploads must be images")
    content = await file.read()
    if not content or len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Gallery image must be between 1 byte and 8MB")
    center = _require_active_client_center(db, user)
    keys = list(center.gallery_keys or [])
    if len(keys) >= 12:
        raise HTTPException(status_code=400, detail="A listing can have up to 12 gallery images")
    key = upload_file(content, file.filename or "gallery.jpg", file.content_type or "image/jpeg")
    keys.append(key)
    center.gallery_keys = keys
    if not center.image_key:
        center.image_key = key
    db.commit()
    return {
        "gallery_keys": keys,
        "gallery_urls": [get_public_url(k) for k in keys],
        "image_key": center.image_key,
        "image_url": resolve_image_url(center.image_key),
    }


@router.delete("/api/client/my-center/gallery/{index}")
def delete_center_gallery_image(index: int, user: ActiveSubscriber, db: Annotated[Session, Depends(get_db)]):
    center = _require_active_client_center(db, user)
    keys = list(center.gallery_keys or [])
    if index < 0 or index >= len(keys):
        raise HTTPException(status_code=404, detail="Gallery image not found")
    keys.pop(index)
    center.gallery_keys = keys
    db.commit()
    return {"gallery_keys": keys, "gallery_urls": [get_public_url(k) for k in keys]}


@router.get("/api/client/my-center")
def get_my_center_enriched(user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    center = _client_center(db, user)
    if not center:
        return None
    out = RehabCenterAdmin.model_validate(center).model_dump()
    out["completeness"] = _completeness(center)
    sub = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    out["subscription_status"] = sub.status if sub else "inactive"
    out["dashboard_locked"] = not (sub and sub.status in ("active", "trialing", "past_due"))
    out["gallery_urls"] = [get_public_url(k) for k in (center.gallery_keys or [])]
    out["image_url"] = resolve_image_url(center.image_key)
    out["public_listing_path"] = _public_listing_path(center)
    out["public_listing_url"] = _public_listing_url(center)
    out["verified_badge"] = bool(center.verified_badge)
    out["featured_active"] = _featured_active(center)
    out["featured_until"] = center.featured_until.isoformat() if center.featured_until else None
    return out


@router.get("/api/client/upsells")
def list_upsells(user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    center = _client_center(db, user)
    products = []
    for p in UPSELL_CATALOG:
        status = _upsell_status_for_center(db, center, p["product_type"])
        products.append(
            {
                "product_type": p["product_type"].value,
                "label": p["label"],
                "price_label": p["price_label"],
                "fulfillment": p["fulfillment"].value,
                "description": p["description"],
                **status,
                "preview": {
                    "verified_badge": p["product_type"] == UpsellProductType.verified_badge,
                    "featured_placement": p["product_type"] == UpsellProductType.featured_placement,
                    "article": p["product_type"]
                    in (UpsellProductType.featured_article, UpsellProductType.article_aeo),
                },
            }
        )
    return {
        "center_id": center.id if center else None,
        "center_name": center.name if center else None,
        "public_listing_url": _public_listing_url(center) if center else None,
        "public_listing_path": _public_listing_path(center) if center else None,
        "verified_badge": bool(center.verified_badge) if center else False,
        "featured_active": _featured_active(center) if center else False,
        "products": products,
    }


@router.post("/api/client/upsells/checkout")
def upsell_checkout(body: UpsellCheckoutRequest, user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    center = _require_active_client_center(db, user)
    catalog = next((p for p in UPSELL_CATALOG if p["product_type"] == body.product_type), None)
    if not catalog:
        raise HTTPException(status_code=404, detail="Unknown product")

    order = UpsellOrder(
        user_id=user.id,
        rehab_center_id=center.id,
        product_type=catalog["product_type"],
        fulfillment=catalog["fulfillment"],
        status=UpsellOrderStatus.pending,
        amount_cents=catalog["amount_cents"],
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    if catalog["fulfillment"] == UpsellFulfillment.human:
        order.status = UpsellOrderStatus.paid
        db.commit()
        alert_to = settings.upsell_alert_email or settings.email_from
        send_email(
            db,
            to_email=alert_to,
            template_key="upsell_human_lead",
            context={
                "name": user.email,
                "email": user.email,
                "product_label": catalog["label"],
                "center_name": center.name,
                "order_id": str(order.id),
            },
            user_id=user.id,
            rehab_center_id=center.id,
        )
        return {"mode": "human", "order_id": order.id, "message": "Thanks — a specialist will contact you to close this package."}

    # Self-serve via Stripe Checkout (one-time or recurring price IDs from env)
    import stripe

    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    stripe.api_key = settings.stripe_secret_key
    sub = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    customer_id = sub.stripe_customer_id if sub else None
    if not customer_id:
        customer = stripe.Customer.create(email=user.email, metadata={"user_id": str(user.id)})
        customer_id = customer.id

    price_id = None
    mode = "payment"
    if body.product_type == UpsellProductType.verified_badge:
        price_id = settings.stripe_price_verified_badge
    elif body.product_type == UpsellProductType.featured_placement:
        price_id = settings.stripe_price_featured_placement
        mode = "subscription"

    if not price_id:
        # Fallback: price_data so checkout still works without pre-created Stripe prices
        line_item = {
            "price_data": {
                "currency": "usd",
                "unit_amount": catalog["amount_cents"],
                "product_data": {"name": catalog["label"]},
                **({"recurring": {"interval": "month"}} if mode == "subscription" else {}),
            },
            "quantity": 1,
        }
    else:
        line_item = {"price": price_id, "quantity": 1}
        mode = "subscription" if body.product_type == UpsellProductType.featured_placement else "payment"

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode=mode,
        line_items=[line_item],
        success_url=f"{settings.admin_site_url}/client/upsells?success=1",
        cancel_url=f"{settings.admin_site_url}/client/upsells?canceled=1",
        metadata={
            "user_id": str(user.id),
            "upsell_order_id": str(order.id),
            "product_type": body.product_type.value,
            "rehab_center_id": str(center.id),
        },
    )
    order.stripe_checkout_session_id = session.id
    db.commit()
    return {"mode": "checkout", "checkout_url": session.url, "order_id": order.id}


@router.get("/api/admin/upsell-orders")
def admin_upsell_orders(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    orders = db.query(UpsellOrder).order_by(UpsellOrder.created_at.desc()).limit(200).all()
    return [
        {
            "id": o.id,
            "product_type": o.product_type.value,
            "fulfillment": o.fulfillment.value,
            "status": o.status.value,
            "amount_cents": o.amount_cents,
            "user_id": o.user_id,
            "rehab_center_id": o.rehab_center_id,
            "center_name": o.center.name if o.center else None,
            "created_at": o.created_at,
        }
        for o in orders
    ]


@router.patch("/api/admin/upsell-orders/{order_id}")
def admin_update_upsell_order(
    order_id: int,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
    status: str | None = None,
):
    order = db.query(UpsellOrder).filter(UpsellOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Upsell order not found")
    if status:
        try:
            order.status = UpsellOrderStatus(status)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid status") from exc
        if order.status == UpsellOrderStatus.fulfilled:
            order.fulfilled_at = datetime.now(timezone.utc)
            user = db.query(User).filter(User.id == order.user_id).first()
            center = db.query(RehabCenter).filter(RehabCenter.id == order.rehab_center_id).first()
            if user:
                send_email(
                    db,
                    to_email=user.email,
                    template_key="upsell_fulfilled",
                    context={
                        "name": user.email,
                        "center_name": center.name if center else "your listing",
                        "product_label": order.product_type.value.replace("_", " ").title(),
                        "listing_url": _public_listing_url(center) if center else settings.public_site_url,
                        "login_url": f"{settings.public_site_url.rstrip('/')}/portal",
                    },
                    user_id=user.id,
                    rehab_center_id=order.rehab_center_id,
                )
    db.commit()
    return {"id": order.id, "status": order.status.value}


@router.get("/api/admin/leads")
def admin_list_leads(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    leads = db.query(CenterLead).order_by(CenterLead.created_at.desc()).limit(300).all()
    return [
        {
            "id": lead.id,
            "full_name": lead.full_name,
            "email": lead.email,
            "phone": lead.phone,
            "message": lead.message,
            "source_url": lead.source_url,
            "created_at": lead.created_at,
            "read_at": lead.read_at,
            "rehab_center_id": lead.rehab_center_id,
            "center_name": lead.center.name if lead.center else None,
        }
        for lead in leads
    ]


