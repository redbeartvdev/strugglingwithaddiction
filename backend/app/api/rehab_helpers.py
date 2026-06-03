from sqlalchemy.orm import Session

from app.models.billing import Subscription
from app.models.rehab import RehabCenter
from app.models.user import User
from app.schemas.rehab import RehabCenterPublic
from app.services.storage import resolve_image_url


def center_has_active_subscription(db: Session, center: RehabCenter) -> bool:
    if not center.owner_user_id:
        return False
    sub = db.query(Subscription).filter(Subscription.user_id == center.owner_user_id).first()
    return sub is not None and sub.status in ("active", "trialing")


def _tier_rank(tier) -> int:
    order = {"custom": 0, "premium": 1, "standard": 2, "free": 3}
    return order.get(getattr(tier, "value", tier) or "free", 3)


def center_to_public(db: Session, center: RehabCenter) -> RehabCenterPublic:
    show_contact = center.contact_visible or (
        center.claimed and center_has_active_subscription(db, center)
    )
    gallery = [resolve_image_url(k) for k in (center.gallery_keys or []) if k]
    return RehabCenterPublic(
        id=center.id,
        slug=center.slug,
        name=center.name,
        location=center.location_display,
        city=center.city,
        state=center.state,
        zip=center.zip,
        address_line=center.address_line if show_contact else None,
        phone=center.phone if show_contact else None,
        website=center.website if show_contact else None,
        image=resolve_image_url(center.image_key),
        gallery=[u for u in gallery if u],
        specialties=center.specialties or [],
        treatment_levels=center.treatment_levels or [],
        insurance_accepted=center.insurance_accepted or [],
        accreditations=center.accreditations or [],
        description=center.description,
        rating=float(center.rating),
        claimed=center.claimed and show_contact,
        listing_tier=center.listing_tier,
        is_sponsored=center.is_sponsored,
    )


def sort_centers_for_listing(centers: list[RehabCenter]) -> list[RehabCenter]:
    return sorted(
        centers,
        key=lambda c: (
            _tier_rank(c.listing_tier),
            0 if c.is_sponsored else 1,
            0 if c.claimed else 1,
            -float(c.rating),
            c.name.lower(),
        ),
    )
