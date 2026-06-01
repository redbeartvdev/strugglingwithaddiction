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


def center_to_public(db: Session, center: RehabCenter) -> RehabCenterPublic:
    show_contact = center.contact_visible or (
        center.claimed and center_has_active_subscription(db, center)
    )
    return RehabCenterPublic(
        id=center.id,
        slug=center.slug,
        name=center.name,
        location=center.location_display,
        phone=center.phone if show_contact else None,
        website=center.website if show_contact else None,
        image=resolve_image_url(center.image_key),
        specialties=center.specialties or [],
        description=center.description,
        rating=float(center.rating),
        claimed=center.claimed and show_contact,
    )
