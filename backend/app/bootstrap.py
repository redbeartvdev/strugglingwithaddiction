from datetime import datetime, timedelta, timezone
import logging
import re

from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import hash_password, verify_password

logger = logging.getLogger("swa")

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
from app.models.billing import BillingInterval, Subscription, SubscriptionPlan
from app.data.insurance_editorial import INSURANCE_EDITORIAL_SEED
from app.models.insurance import InsuranceCatalog
from app.models.profile import UserProfile
from app.models.rehab import RehabCenter, ListingStatus, CenterSource, ClaimStatus, RehabCenterClaim
from app.models.user import User, UserRole

USA_INSURANCE_SEED = [
    ("Aetna", "aetna", "/images/insurance/aetna.png", 10),
    ("Blue Cross Blue Shield", "blue-cross-blue-shield", "/images/insurance/blue-cross-blue-shield.png", 20),
    ("Cigna", "cigna", "/images/insurance/cigna.png", 30),
    ("UnitedHealthcare", "unitedhealthcare", "/images/insurance/unitedhealthcare.png", 40),
    ("Anthem", "anthem", "/images/insurance/anthem.png", 50),
    ("Humana", "humana", "/images/insurance/humana.png", 60),
    ("Kaiser Permanente", "kaiser-permanente", "/images/insurance/kaiser-permanente.png", 70),
    ("Medicaid", "medicaid", "/images/insurance/medicaid.png", 80),
    ("Medicare", "medicare", "/images/insurance/medicare.png", 90),
    ("Tricare", "tricare", "/images/insurance/tricare.png", 100),
    ("Optum", "optum", "/images/insurance/optum.png", 110),
    ("Magellan Health", "magellan-health", "/images/insurance/magellan-health.png", 120),
    ("Beacon Health Options", "beacon-health", "/images/insurance/beacon-health.png", 130),
    ("ComPsych", "compsych", "/images/insurance/compsych.png", 135),
    ("Health Net", "health-net", "/images/insurance/health-net.png", 138),
    ("Optima Health", "optima-health", "/images/insurance/optima-health.png", 142),
    ("MultiPlan", "multiplan", "/images/insurance/multiplan.png", 145),
    ("AmeriHealth", "amerihealth", "/images/insurance/amerihealth.png", 148),
    ("Molina Healthcare", "molina", "/images/insurance/molina.png", 150),
    ("Ambetter", "ambetter", "/images/insurance/ambetter.png", 160),
    ("Oscar Health", "oscar", "/images/insurance/oscar.png", 170),
    ("WellCare", "wellcare", "/images/insurance/wellcare.png", 180),
    ("Centene", "centene", "/images/insurance/centene.png", 190),
    ("Other Insurance", "other-insurance", "/images/insurance/other-insurance.png", 220),
]

settings = get_settings()

# Demo provider password for seeded claimed centers (local / staging bootstrap only).
DEMO_PROVIDER_PASSWORD = "Provider123!"

REHAB_SEED = [
    {
        "slug": "hazelden-betty-ford-foundation",
        "name": "Hazelden Betty Ford Foundation",
        "location_display": "Rancho Mirage, California",
        "address_line": "39000 Bob Hope Drive",
        "city": "Rancho Mirage",
        "state": "California",
        "zip": "92270",
        "phone": "1-866-831-5700",
        "website": "https://www.hazeldenbettyford.org",
        "contact_email": "hazelden@example.com",
        "google_maps_url": "https://maps.google.com/?q=Hazelden+Betty+Ford+Rancho+Mirage",
        "google_reviews_url": "https://www.google.com/maps/search/?api=1&query=Hazelden+Betty+Ford+Rancho+Mirage",
        "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "image_key": "/images/rehab/hazelden-betty-ford.webp",
        "gallery_keys": [
            "/images/rehab/hazelden-betty-ford.webp",
        ],
        "specialties": ["Inpatient Residential", "Medical Detox", "Dual Diagnosis", "Telehealth"],
        "levels_of_care": ["Detox", "Residential", "IOP", "Outpatient"],
        "insurances": ["Aetna", "Blue Cross Blue Shield", "Cigna", "UnitedHealthcare"],
        "amenities": ["Private rooms", "Fitness center", "Family program"],
        "accreditations": ["Joint Commission", "CARF"],
        "testimonials": [
            {"quote": "Compassionate care that helped our family rebuild.", "author": "Former family member", "rating": 5},
            {"quote": "The clinical team treated the whole person — not just the addiction.", "author": "Alumni", "rating": 5},
            {"quote": "Clear communication and a plan we could trust from day one.", "author": "Parent", "rating": 5},
            {"quote": "Aftercare support made the transition home feel possible.", "author": "Alumni", "rating": 4},
        ],
        "description": "The Betty Ford Center is a world-renowned inpatient addiction treatment facility co-founded in 1982 by former First Lady Betty Ford.",
        "rating": 5.0,
        "claimed": True,
        "contact_visible": True,
        "verified_badge": True,
        "listing_status": ListingStatus.published,
        "owner_email": "hazelden@example.com",
        "owner_name": "Hazelden Provider",
    },
    {
        "slug": "caron-treatment-centers",
        "name": "Caron Treatment Centers",
        "location_display": "Wernersville, Pennsylvania",
        "address_line": "243 N Galen Hall Rd",
        "city": "Wernersville",
        "state": "Pennsylvania",
        "zip": "19565",
        "phone": "1-800-854-6023",
        "website": "https://www.caron.org",
        "contact_email": "caron@example.com",
        "google_maps_url": "https://maps.google.com/?q=Caron+Treatment+Centers+Wernersville",
        "google_reviews_url": "https://www.google.com/maps/search/?api=1&query=Caron+Treatment+Centers+Wernersville",
        "image_key": "/images/rehab/caron-treatment-centers.webp",
        "gallery_keys": [
            "/images/rehab/caron-treatment-centers.webp",
        ],
        "specialties": ["Medical Detox", "Inpatient", "Dual Diagnosis", "Executive Program"],
        "levels_of_care": ["Detox", "Residential", "PHP", "IOP"],
        "insurances": ["Aetna", "Blue Cross Blue Shield", "Cigna", "UnitedHealthcare", "Tricare"],
        "amenities": ["Executive track", "Medical staff onsite", "Family workshops"],
        "accreditations": ["Joint Commission"],
        "testimonials": [
            {"quote": "A structured program with real medical depth.", "author": "Alumni", "rating": 5},
            {"quote": "Staff were steady, honest, and deeply skilled.", "author": "Family member", "rating": 5},
            {"quote": "I left with tools I still use every day.", "author": "Alumni", "rating": 5},
            {"quote": "The family workshops helped us repair what addiction broke.", "author": "Spouse", "rating": 4},
        ],
        "description": "Caron is a nationally recognized nonprofit provider of comprehensive addiction and behavioral health treatment.",
        "rating": 5.0,
        "claimed": True,
        "contact_visible": True,
        "verified_badge": True,
        "listing_status": ListingStatus.published,
        "owner_email": "caron@example.com",
        "owner_name": "Caron Provider",
    },
    {
        "slug": "sierra-tucson",
        "name": "Sierra Tucson",
        "location_display": "Tucson, Arizona",
        "city": "Tucson",
        "state": "Arizona",
        "phone": "(844) 276-1469",
        "website": "https://www.sierratucson.com",
        "image_key": "/images/rehab/sierra-tucson.webp",
        "specialties": ["Residential", "Trauma & PTSD", "Eating Disorders", "Equine Therapy"],
        "description": "Ranked #1 in Newsweek's Best Addiction Treatment Centers in Arizona for 2025, Sierra Tucson sits on a stunning 160-acre campus.",
        "rating": 5.0,
        "claimed": False,
        "listing_status": ListingStatus.published,
    },
    {
        "slug": "the-ranch-tennessee",
        "name": "The Ranch Tennessee",
        "location_display": "Nunnelly, Tennessee",
        "city": "Nunnelly",
        "state": "Tennessee",
        "phone": "(931) 416-1559",
        "website": "https://www.theranch.com",
        "image_key": "/images/rehab/the-ranch-tennessee.webp",
        "specialties": ["Substance Use", "Mental Health", "Equine Therapy", "Extended Care"],
        "description": "Located on peaceful grounds along the Piney River, The Ranch combines traditional and alternative therapies.",
        "rating": 4.0,
        "claimed": False,
        "listing_status": ListingStatus.published,
    },
    {
        "slug": "mclean-hospital",
        "name": "McLean Hospital",
        "location_display": "Belmont, Massachusetts",
        "city": "Belmont",
        "state": "Massachusetts",
        "phone": "617-855-2000",
        "website": "https://www.mcleanhospital.org",
        "image_key": "/images/rehab/mclean-hospital.webp",
        "specialties": ["Harvard-Affiliated", "Medical Detox", "Inpatient & IOP", "Co-occurring Disorders"],
        "description": "The largest psychiatric teaching hospital of Harvard Medical School and ranked #1 by U.S. News & World Report.",
        "rating": 5.0,
        "claimed": False,
        "listing_status": ListingStatus.published,
    },
]


def _valid_admin_email(email: str) -> bool:
    return bool(_EMAIL_RE.match(email.strip()))


def _normalize_admin_email() -> str:
    email = settings.admin_bootstrap_email.strip().lower()
    if _valid_admin_email(email):
        return email
    logger.warning(
        "Invalid ADMIN_BOOTSTRAP_EMAIL=%r — using admin@strugglingwithaddiction.com",
        settings.admin_bootstrap_email,
    )
    return "admin@strugglingwithaddiction.com"


def bootstrap_admin(db: Session) -> None:
    """Ensure the configured bootstrap admin can always access the platform."""
    email = _normalize_admin_email()

    for bad in db.query(User).filter(User.role == UserRole.admin).all():
        if not _valid_admin_email(bad.email):
            logger.warning("Removing invalid admin account email=%r id=%s", bad.email, bad.id)
            if bad.profile:
                db.delete(bad.profile)
            db.delete(bad)
    db.commit()

    user = db.query(User).filter(User.email == email).first()
    if user:
        changed = False
        if user.role != UserRole.admin:
            user.role = UserRole.admin
            changed = True
        if not user.is_active:
            user.is_active = True
            changed = True
        # ADMIN_BOOTSTRAP_EMAIL/PASSWORD are recovery credentials. Keep the
        # configured account in sync so rotating the Railway variable repairs
        # access instead of leaving an old database hash behind.
        if not verify_password(settings.admin_bootstrap_password, user.password_hash):
            user.password_hash = hash_password(settings.admin_bootstrap_password)
            changed = True
            logger.info("Synchronized bootstrap admin password for %s", email)
        if changed:
            db.commit()
        return

    user = User(
        email=email,
        password_hash=hash_password(settings.admin_bootstrap_password),
        role=UserRole.admin,
        is_active=True,
    )
    db.add(user)
    db.flush()
    db.add(UserProfile(user_id=user.id, display_name="Administrator", slug="admin"))
    db.commit()
    logger.info("Created bootstrap admin %s", email)


def bootstrap_plans(db: Session) -> None:
    if db.query(SubscriptionPlan).first():
        return
    plan = SubscriptionPlan(
        name="Base listing",
        stripe_price_id_monthly=settings.stripe_price_monthly or None,
        stripe_price_id_yearly=settings.stripe_price_yearly or None,
        is_active=True,
        sort_order=0,
        features={"blog": True, "listing": True, "landing_page": True, "price_month": "9.99", "price_year": "99.99"},
    )
    db.add(plan)
    db.commit()


def _ensure_active_subscription(db: Session, user: User) -> None:
    plan = db.query(SubscriptionPlan).order_by(SubscriptionPlan.sort_order, SubscriptionPlan.id).first()
    sub = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    if not sub:
        sub = Subscription(user_id=user.id)
        db.add(sub)
    sub.plan_id = plan.id if plan else None
    sub.interval = BillingInterval.year
    sub.status = "active"
    sub.current_period_end = datetime.now(timezone.utc) + timedelta(days=365)
    if not user.is_active:
        user.is_active = True


def _ensure_claimed_owner(db: Session, center: RehabCenter, owner_email: str, owner_name: str) -> None:
    email = owner_email.lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            password_hash=hash_password(DEMO_PROVIDER_PASSWORD),
            role=UserRole.client,
            is_active=True,
        )
        db.add(user)
        db.flush()
        db.add(UserProfile(user_id=user.id, display_name=owner_name, slug=f"provider-{center.slug}"))
    else:
        user.role = UserRole.client
        user.is_active = True
        user.password_hash = hash_password(DEMO_PROVIDER_PASSWORD)
        profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        if not profile:
            db.add(UserProfile(user_id=user.id, display_name=owner_name, slug=f"provider-{center.slug}"))
    center.owner_user_id = user.id
    center.claimed = True
    center.contact_visible = True
    _ensure_active_subscription(db, user)


def seed_rehab_centers(db: Session) -> None:
    if db.query(RehabCenter).count() == 0:
        for item in REHAB_SEED:
            payload = {k: v for k, v in item.items() if k not in ("owner_email", "owner_name")}
            center = RehabCenter(source=CenterSource.imported, **payload)
            db.add(center)
        db.commit()

    # Always ensure claimed seed centers have city/state, rich fields, owners, and active subscriptions.
    for item in REHAB_SEED:
        center = db.query(RehabCenter).filter(RehabCenter.slug == item["slug"]).first()
        if not center:
            continue
        for field in (
            "address_line", "city", "state", "zip", "contact_email", "google_maps_url",
            "google_reviews_url", "video_url", "levels_of_care", "insurances", "amenities",
            "accreditations", "testimonials", "location_display", "phone", "website", "description",
            "gallery_keys",
        ):
            # Fill missing values; for claimed demo listings, keep screenshot-critical fields aligned.
            value = item.get(field)
            if value is None:
                continue
            current = getattr(center, field, None)
            if not current or (item.get("claimed") and field in {
                "contact_email", "address_line", "city", "state", "zip",
                "gallery_keys", "google_maps_url", "google_reviews_url",
                "levels_of_care", "insurances", "amenities", "accreditations", "testimonials",
            }):
                setattr(center, field, value)
        # Keep claimed demo galleries aligned to this listing's own images only.
        if item.get("gallery_keys") is not None and item.get("claimed"):
            center.gallery_keys = item["gallery_keys"]
        # Keep demo placeholder insurance lists aligned with the USA catalog.
        old_demo = {"most major insurance", "private pay", "blue cross"}
        current = {str(x).lower() for x in (center.insurances or [])}
        if item.get("insurances") and item.get("claimed") and (not current or current <= old_demo or "private pay" in current):
            center.insurances = item["insurances"]
        elif center.insurances:
            center.insurances = [
                n for n in center.insurances
                if str(n).strip().lower() not in {"private pay", "self pay", "self-pay"}
            ]
        if item.get("claimed"):
            center.claimed = True
            center.contact_visible = True
            if item.get("verified_badge"):
                center.verified_badge = True
        if center.listing_status != ListingStatus.published and item.get("listing_status") == ListingStatus.published:
            center.listing_status = ListingStatus.published
        # Persist listing fields even if owner/subscription wiring fails.
        db.commit()
        if item.get("claimed") and item.get("owner_email"):
            try:
                _ensure_claimed_owner(db, center, item["owner_email"], item.get("owner_name") or center.name)
                db.commit()
            except Exception:
                db.rollback()
                logger.exception("Failed to ensure claimed owner for %s", item.get("slug"))


def activate_claimed_providers(db: Session) -> None:
    """Ensure owners of claimed listings (and approved claims) can sign in."""
    claimed_centers = (
        db.query(RehabCenter)
        .filter(RehabCenter.claimed.is_(True), RehabCenter.owner_user_id.isnot(None))
        .all()
    )
    activated = 0
    for center in claimed_centers:
        user = db.query(User).filter(User.id == center.owner_user_id).first()
        if user and user.role == UserRole.client and not user.is_active:
            user.is_active = True
            activated += 1

    approved_claims = (
        db.query(RehabCenterClaim)
        .filter(
            RehabCenterClaim.status == ClaimStatus.approved,
            RehabCenterClaim.submitter_user_id.isnot(None),
        )
        .all()
    )
    for claim in approved_claims:
        user = db.query(User).filter(User.id == claim.submitter_user_id).first()
        if user and user.role == UserRole.client and not user.is_active:
            user.is_active = True
            activated += 1

    if activated:
        db.commit()
        logger.info("Activated %s claimed/approved provider account(s)", activated)


def seed_insurance_catalog(db: Session) -> dict[str, int]:
    """Idempotent seed of USA insurance options with PNG logos.

    Returns counts: created, updated, total.
    Editorial fields are filled only when empty so admin edits survive reseed.
    """
    existing = {row.slug: row for row in db.query(InsuranceCatalog).all()}
    created = 0
    updated = 0
    for name, slug, logo_path, sort_order in USA_INSURANCE_SEED:
        row = existing.get(slug)
        editorial = INSURANCE_EDITORIAL_SEED.get(slug)
        if row:
            row.name = name
            row.logo_path = logo_path
            row.sort_order = sort_order
            if editorial and not (row.content_html or "").strip():
                for key, value in editorial.items():
                    setattr(row, key, value)
            updated += 1
            continue
        payload = dict(
            name=name,
            slug=slug,
            logo_path=logo_path,
            enabled=True,
            sort_order=sort_order,
        )
        if editorial:
            payload.update(editorial)
        db.add(InsuranceCatalog(**payload))
        created += 1
    db.commit()
    # Private Pay / Self Pay were removed from the public catalog — disable legacy rows.
    retired = (
        db.query(InsuranceCatalog)
        .filter(InsuranceCatalog.slug.in_(("private-pay", "self-pay")))
        .all()
    )
    for row in retired:
        if row.enabled:
            row.enabled = False
            updated += 1
    if retired:
        db.commit()
    total = db.query(InsuranceCatalog).filter(InsuranceCatalog.enabled.is_(True)).count()
    logger.info("Insurance catalog seed: created=%s updated=%s enabled=%s", created, updated, total)
    return {"created": created, "updated": updated, "total": total}
