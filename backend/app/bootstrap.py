from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import hash_password
from app.models.billing import SubscriptionPlan
from app.models.profile import UserProfile
from app.models.rehab import RehabCenter, ListingStatus, CenterSource
from app.models.user import User, UserRole

settings = get_settings()

REHAB_SEED = [
    {
        "slug": "hazelden-betty-ford-foundation",
        "name": "Hazelden Betty Ford Foundation",
        "location_display": "Rancho Mirage, California",
        "phone": "1-866-831-5700",
        "website": "https://www.hazeldenbettyford.org",
        "image_key": "/images/rehab/hazelden-betty-ford.webp",
        "specialties": ["Inpatient Residential", "Medical Detox", "Dual Diagnosis", "Telehealth"],
        "description": "The Betty Ford Center is a world-renowned inpatient addiction treatment facility co-founded in 1982 by former First Lady Betty Ford.",
        "rating": 5.0,
        "claimed": True,
        "contact_visible": True,
        "listing_status": ListingStatus.published,
    },
    {
        "slug": "caron-treatment-centers",
        "name": "Caron Treatment Centers",
        "location_display": "Wernersville, Pennsylvania",
        "phone": "1-800-854-6023",
        "website": "https://www.caron.org",
        "image_key": "/images/rehab/caron-treatment-centers.webp",
        "specialties": ["Medical Detox", "Inpatient", "Dual Diagnosis", "Executive Program"],
        "description": "Caron is a nationally recognized nonprofit provider of comprehensive addiction and behavioral health treatment.",
        "rating": 5.0,
        "claimed": True,
        "contact_visible": True,
        "listing_status": ListingStatus.published,
    },
    {
        "slug": "sierra-tucson",
        "name": "Sierra Tucson",
        "location_display": "Tucson, Arizona",
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


def bootstrap_admin(db: Session) -> None:
    email = settings.admin_bootstrap_email.lower()
    if db.query(User).filter(User.email == email).first():
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


def bootstrap_plans(db: Session) -> None:
    if db.query(SubscriptionPlan).first():
        return
    plan = SubscriptionPlan(
        name="Partner Membership",
        stripe_price_id_monthly=settings.stripe_price_monthly or None,
        stripe_price_id_yearly=settings.stripe_price_yearly or None,
        is_active=True,
        sort_order=0,
        features={"blog": True, "listing": True, "landing_page": True},
    )
    db.add(plan)
    db.commit()


def seed_rehab_centers(db: Session) -> None:
    if db.query(RehabCenter).count() > 0:
        return
    for item in REHAB_SEED:
        center = RehabCenter(source=CenterSource.imported, **item)
        db.add(center)
    db.commit()
