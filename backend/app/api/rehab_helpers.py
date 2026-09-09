from datetime import datetime, timezone
import re

from sqlalchemy.orm import Session

from app.models.billing import Subscription
from app.models.insurance import InsuranceCatalog
from app.models.rehab import ListingStatus, RehabCenter
from app.schemas.rehab import InsuranceDetail, RehabCenterPublic
from app.services.email import get_platform_email_settings
from app.services.listing_media import LISTING_PLACEHOLDER_IMAGE, listing_image_key
from app.services.service_codes import center_codes_match_filter, resolve_service_details
from app.services.storage import resolve_image_url

# Keyword map mirrors src/lib/rehabServices.js REHAB_SERVICE_TYPES
SERVICE_KEYWORDS: dict[str, list[str]] = {
    "inpatient": ["inpatient", "residential"],
    "outpatient": ["outpatient"],
    "iop": ["iop", "intensive outpatient"],
    "php": ["php", "partial hospitalization"],
    "detox": ["detox", "medical detox"],
    "dual-diagnosis": ["dual diagnosis", "co-occurring", "co occurring"],
    "mental-health": ["mental health", "behavioral health"],
    "trauma": ["trauma", "ptsd"],
    "mat": ["mat", "medication-assisted", "medication assisted", "suboxone", "methadone"],
    "telehealth": ["telehealth", "virtual", "online"],
    "executive": ["executive"],
    "equine": ["equine"],
    "extended-care": ["extended care", "long-term", "long term"],
    "family": ["family"],
    "eating-disorders": ["eating disorder"],
    "substance-use": ["substance use", "addiction"],
}


def center_has_active_subscription(db: Session, center: RehabCenter) -> bool:
    if not center.owner_user_id:
        return False
    sub = db.query(Subscription).filter(Subscription.user_id == center.owner_user_id).first()
    # Preserve the paid listing while Stripe Smart Retries a failed renewal.
    return sub is not None and sub.status in ("active", "trialing", "past_due")


def _norm(value: str) -> str:
    return " ".join(str(value or "").lower().replace("-", " ").split())


def _norm_search(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9\s]+", " ", str(value or "").lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def landing_segment(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(value or "").lower().strip()).strip("-")


def center_landing_path(center: RehabCenter) -> str | None:
    state = center.state or (center.location_display or "").split(",")[-1].strip()
    city = center.city or (center.location_display or "").split(",")[0].strip()
    if not state or not city or not center.name:
        return None
    return (
        f"/rehabs/united-states/{landing_segment(state)}/"
        f"{landing_segment(city)}/{landing_segment(center.name)}"
    )


def is_indexable_listing(center: RehabCenter) -> bool:
    """Quality floor for a crawlable facility page (not claimed-only).

    Requires a real place plus contact and program facts so we do not emit
    13k doorway stubs. Street/phone may be redacted on the public JSON for
    unclaimed rows; they still count here because the record is complete.
    """
    if center.listing_status != ListingStatus.published or center.deleted_at is not None:
        return False
    if not landing_segment(center.name) or not landing_segment(center.city) or not landing_segment(center.state):
        return False
    has_contact = bool((center.address_line or "").strip() or (center.phone or "").strip())
    has_program = bool(
        (center.description or "").strip()
        or (center.specialties or [])
        or (center.levels_of_care or [])
        or (center.service_codes or [])
    )
    return has_contact and has_program


def published_centers_query(db: Session):
    return db.query(RehabCenter).filter(
        RehabCenter.listing_status == ListingStatus.published,
        RehabCenter.deleted_at.is_(None),
    )


def find_center_by_landing(db: Session, state: str, city: str, facility: str) -> RehabCenter | None:
    state_slug = landing_segment(state)
    city_slug = landing_segment(city)
    facility_slug = landing_segment(facility)
    if not state_slug or not city_slug or not facility_slug:
        return None
    candidates = published_centers_query(db).filter(
        RehabCenter.city.isnot(None),
        RehabCenter.state.isnot(None),
    ).all()
    for item in candidates:
        if (
            landing_segment(item.state) == state_slug
            and landing_segment(item.city) == city_slug
            and landing_segment(item.name) == facility_slug
        ):
            return item
    return None


def find_center_by_slug(db: Session, slug: str) -> RehabCenter | None:
    clean = (slug or "").strip().strip("/")
    if not clean:
        return None
    return published_centers_query(db).filter(RehabCenter.slug == clean).first()


def center_matches_service(center: RehabCenter, service_id: str | None) -> bool:
    if not service_id:
        return True
    keywords = SERVICE_KEYWORDS.get(service_id.strip().lower())
    if not keywords:
        return False
    if center_codes_match_filter(getattr(center, "service_codes", None), service_id):
        return True
    haystack = _norm_search(" ".join([*(center.specialties or []), *(center.levels_of_care or [])]))
    return any(_norm_search(kw) in haystack for kw in keywords)


def center_matches_insurance(center: RehabCenter, insurance: str | None) -> bool:
    if not insurance:
        return True
    needle = _norm_search(insurance)
    if not needle:
        return True
    names = [n for n in (center.insurances or []) if n]
    if not names:
        return False
    if needle in ("other insurance", "other"):
        return any(
            _norm_search(n) in ("other", "other insurance") or "other insurance" in _norm_search(n)
            for n in names
        )
    return any(needle in _norm_search(n) or _norm_search(n) in needle for n in names)

def resolve_insurance_details(db: Session, names: list[str] | None) -> list[InsuranceDetail]:
    """Map free-text insurance names to catalog rows (logos) when possible."""
    if not names:
        return []
    catalog = db.query(InsuranceCatalog).filter(InsuranceCatalog.enabled.is_(True)).all()
    by_name = {_norm(row.name): row for row in catalog}
    by_slug = {_norm(row.slug): row for row in catalog}
    # Common aliases
    aliases = {
        "blue cross": "blue cross blue shield",
        "bluecross blueshield": "blue cross blue shield",
        "bcbs": "blue cross blue shield",
        "united healthcare": "unitedhealthcare",
        "united health": "unitedhealthcare",
        "uhc": "unitedhealthcare",
        "most major insurance": None,
        "private pay": None,
        "private-pay": None,
        "self pay": None,
        "self-pay": None,
        "selfpay": None,
    }
    details: list[InsuranceDetail] = []
    seen: set[str] = set()
    skip = {"private pay", "private-pay", "self pay", "self-pay", "selfpay"}
    for raw in names:
        key = _norm(raw)
        if not key or key in seen:
            continue
        if key in skip:
            continue
        seen.add(key)
        alias = aliases.get(key, key)
        if alias is None:
            continue
        row = by_name.get(alias) or by_slug.get(alias.replace(" ", "-")) or by_name.get(key) or by_slug.get(key)
        if row:
            path = row.logo_path or ""
            logo = path if path.startswith("/") or path.startswith("http") else f"/{path}"
            details.append(InsuranceDetail(name=row.name, slug=row.slug, logo_url=logo))
        else:
            details.append(InsuranceDetail(name=raw, slug=None, logo_url=None))
    return details


def inquiry_forms_globally_enabled(db: Session) -> bool:
    row = get_platform_email_settings(db)
    if row is None:
        return True
    return bool(getattr(row, "inquiry_forms_enabled", True))


def center_inquiry_form_visible(db: Session, center: RehabCenter) -> bool:
    return inquiry_forms_globally_enabled(db) and bool(getattr(center, "inquiry_form_enabled", True))


def public_listing_image(center: RehabCenter) -> str:
    key = listing_image_key(center.image_key)
    if key == LISTING_PLACEHOLDER_IMAGE:
        return LISTING_PLACEHOLDER_IMAGE
    return resolve_image_url(key) or LISTING_PLACEHOLDER_IMAGE


def center_to_public(db: Session, center: RehabCenter) -> RehabCenterPublic:
    premium = center.contact_visible or (
        center.claimed and center_has_active_subscription(db, center)
    )
    # When subscription lapses, public surface reverts to basic + claim CTA
    show_as_claimed = bool(premium)
    featured = bool(
        premium
        and center.featured_until
        and center.featured_until > datetime.now(timezone.utc)
    )
    insurance_names = [
        name for name in (center.insurances or [])
        if str(name).strip().lower() not in {"private pay", "private-pay", "self pay", "self-pay", "selfpay"}
    ]
    return RehabCenterPublic(
        id=center.id,
        slug=center.slug,
        name=center.name,
        location=center.location_display,
        phone=center.phone if premium else None,
        website=center.website if premium else None,
        verification_url=center.verification_url if premium else None,
        contact_email=center.contact_email if premium else None,
        image=public_listing_image(center),
        specialties=center.specialties or [],
        description=center.description,
        rating=float(center.rating),
        claimed=show_as_claimed,
        verified_badge=bool(premium and center.verified_badge),
        featured=featured,
        inquiry_form_enabled=center_inquiry_form_visible(db, center),
        # Insurance names stay public so directory logo filters work; logos stay premium.
        insurances=insurance_names,
        insurance_details=resolve_insurance_details(db, insurance_names) if premium else [],
        # Levels of care stay public so directory service filters work for all listings.
        levels_of_care=center.levels_of_care or [],
        service_codes=list(center.service_codes or []),
        service_details=resolve_service_details(db, center.service_codes),
        amenities=(center.amenities or []) if premium else [],
        accreditations=(center.accreditations or []) if premium else [],
        google_maps_url=center.google_maps_url if premium else None,
        gallery_urls=[resolve_image_url(key) for key in (center.gallery_keys or [])] if premium else [],
        video_url=center.video_url if premium else None,
        address_line=center.address_line if premium else None,
        city=center.city,
        state=center.state,
        zip=center.zip if premium else None,
        google_reviews_url=center.google_reviews_url if premium else None,
        testimonials=(center.testimonials or []) if premium else [],
        public_page=is_indexable_listing(center),
    )


def _active_owner_ids(db: Session, centers: list[RehabCenter]) -> set[int]:
    owner_ids = [center.owner_user_id for center in centers if center.owner_user_id]
    if not owner_ids:
        return set()
    rows = (
        db.query(Subscription.user_id)
        .filter(
            Subscription.user_id.in_(owner_ids),
            Subscription.status.in_(("active", "trialing", "past_due")),
        )
        .all()
    )
    return {row[0] for row in rows}


def centers_to_directory(db: Session, centers: list[RehabCenter]) -> list[RehabCenterPublic]:
    """Serialize directory cards without per-row catalog / settings queries."""
    active_owners = _active_owner_ids(db, centers)
    inquiry_on = inquiry_forms_globally_enabled(db)
    now = datetime.now(timezone.utc)
    items: list[RehabCenterPublic] = []
    for center in centers:
        premium = bool(
            center.contact_visible
            or (center.claimed and center.owner_user_id in active_owners)
        )
        insurance_names = [
            name for name in (center.insurances or [])
            if str(name).strip().lower() not in {"private pay", "private-pay", "self pay", "self-pay", "selfpay"}
        ]
        items.append(
            RehabCenterPublic(
                id=center.id,
                slug=center.slug,
                name=center.name,
                location=center.location_display,
                phone=center.phone if premium else None,
                website=center.website if premium else None,
                verification_url=center.verification_url if premium else None,
                contact_email=center.contact_email if premium else None,
                image=public_listing_image(center),
                specialties=center.specialties or [],
                description=center.description or "",
                rating=float(center.rating),
                claimed=premium,
                verified_badge=bool(premium and center.verified_badge),
                featured=bool(premium and center.featured_until and center.featured_until > now),
                inquiry_form_enabled=inquiry_on and bool(getattr(center, "inquiry_form_enabled", True)),
                insurances=insurance_names,
                levels_of_care=center.levels_of_care or [],
                service_codes=list(center.service_codes or []),
                amenities=(center.amenities or []) if premium else [],
                accreditations=(center.accreditations or []) if premium else [],
                google_maps_url=center.google_maps_url if premium else None,
                address_line=center.address_line if premium else None,
                city=center.city,
                state=center.state,
                zip=center.zip if premium else None,
                google_reviews_url=center.google_reviews_url if premium else None,
                public_page=is_indexable_listing(center),
            )
        )
    return items
