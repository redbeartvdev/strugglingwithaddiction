from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.rehab import ClaimStatus, FacilityRole, ListingStatus, CenterSource


class InsuranceDetail(BaseModel):
    name: str
    slug: str | None = None
    logo_url: str | None = None


class RehabCenterPublic(BaseModel):
    id: int
    slug: str
    name: str
    location: str
    phone: str | None = None
    website: str | None = None
    verification_url: str | None = None
    image: str | None = None
    specialties: list[str]
    description: str
    rating: float
    claimed: bool
    verified_badge: bool = False
    featured: bool = False
    # Premium fields only when claimed+subscribed
    insurances: list[str] = Field(default_factory=list)
    insurance_details: list[InsuranceDetail] = Field(default_factory=list)
    levels_of_care: list[str] = Field(default_factory=list)
    amenities: list[str] = Field(default_factory=list)
    accreditations: list[str] = Field(default_factory=list)
    google_maps_url: str | None = None
    contact_email: str | None = None
    gallery_urls: list[str] = Field(default_factory=list)
    video_url: str | None = None
    address_line: str | None = None
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    google_reviews_url: str | None = None
    testimonials: list = Field(default_factory=list)


class ReviewItem(BaseModel):
    quote: str
    author: str | None = None
    rating: float = 5.0
    relative_time: str | None = None
    source: str = "manual"


class CenterReviewsOut(BaseModel):
    source: str
    rating: float | None = None
    user_ratings_total: int | None = None
    google_maps_url: str | None = None
    google_reviews_url: str | None = None
    reviews: list[ReviewItem] = Field(default_factory=list)


class RehabDirectoryStats(BaseModel):
    claimed: int


class RehabCenterAdmin(BaseModel):
    id: int
    slug: str
    name: str
    description: str
    location_display: str
    address_line: str | None
    city: str | None
    state: str | None
    zip: str | None
    phone: str | None
    website: str | None
    verification_url: str | None = None
    contact_email: str | None = None
    outreach_email: str | None = None
    samhsa_id: str | None = None
    google_maps_url: str | None = None
    google_reviews_url: str | None = None
    video_url: str | None = None
    image_key: str | None
    image_url: str | None = None
    gallery_keys: list | None = None
    gallery_urls: list[str] = Field(default_factory=list)
    rating: float
    specialties: list[str]
    insurances: list[str] | None = None
    levels_of_care: list[str] | None = None
    amenities: list[str] | None = None
    accreditations: list[str] | None = None
    testimonials: list | None = None
    claimed: bool
    contact_visible: bool
    cert_verified_at: datetime | None = None
    verified_badge: bool = False
    featured_until: datetime | None = None
    listing_status: ListingStatus
    owner_user_id: int | None
    source: CenterSource
    scraped_from_url: str | None
    published_at: datetime | None = None
    deleted_at: datetime | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class RehabCenterCreate(BaseModel):
    slug: str
    name: str
    description: str = ""
    location_display: str = ""
    address_line: str | None = None
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    phone: str | None = None
    website: str | None = None
    verification_url: str | None = None
    contact_email: str | None = None
    outreach_email: str | None = None
    google_maps_url: str | None = None
    google_reviews_url: str | None = None
    video_url: str | None = None
    image_key: str | None = None
    rating: float = 5.0
    specialties: list[str] = Field(default_factory=list)
    insurances: list[str] = Field(default_factory=list)
    levels_of_care: list[str] = Field(default_factory=list)
    amenities: list[str] = Field(default_factory=list)
    accreditations: list[str] = Field(default_factory=list)
    testimonials: list = Field(default_factory=list)
    claimed: bool = False
    contact_visible: bool = False
    verified_badge: bool = False
    listing_status: ListingStatus = ListingStatus.draft
    source: CenterSource = CenterSource.manual
    published_at: datetime | None = None


class RehabCenterUpdate(BaseModel):
    slug: str | None = None
    name: str | None = None
    description: str | None = None
    location_display: str | None = None
    address_line: str | None = None
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    phone: str | None = None
    website: str | None = None
    verification_url: str | None = None
    contact_email: str | None = None
    outreach_email: str | None = None
    google_maps_url: str | None = None
    google_reviews_url: str | None = None
    video_url: str | None = None
    image_key: str | None = None
    rating: float | None = None
    specialties: list[str] | None = None
    insurances: list[str] | None = None
    levels_of_care: list[str] | None = None
    amenities: list[str] | None = None
    accreditations: list[str] | None = None
    testimonials: list | None = None
    claimed: bool | None = None
    contact_visible: bool | None = None
    verified_badge: bool | None = None
    featured_until: datetime | None = None
    listing_status: ListingStatus | None = None
    owner_user_id: int | None = None
    published_at: datetime | None = None


class ClaimCreate(BaseModel):
    rehab_center_id: int
    full_name: str
    job_title: str
    work_email: EmailStr
    phone: str | None = None
    affiliation_text: str
    facility_role: FacilityRole = FacilityRole.other
    business_license_url: str | None = None
    proof_of_affiliation_url: str | None = None


class ClaimOut(BaseModel):
    ticket_number: str
    status: ClaimStatus
    center_name: str
    message: str


class ClaimStatusPublic(BaseModel):
    ticket_number: str
    status: ClaimStatus
    center_name: str
    submitted_at: datetime
    reviewed_at: datetime | None
    message: str
    certification_uploaded: bool = False
    email_domain_matched: bool = False
    phone_verified: bool = False
    payment_received: bool = False
    checkout_ready: bool = False


class ClaimAdmin(BaseModel):
    id: int
    ticket_number: str
    rehab_center_id: int
    center_name: str
    status: ClaimStatus
    full_name: str
    job_title: str
    work_email: str
    phone: str | None
    affiliation_text: str
    facility_role: FacilityRole
    business_license_url: str | None = None
    proof_of_affiliation_url: str | None = None
    email_domain_matched: bool = False
    cert_verified_at: datetime | None = None
    payment_received_at: datetime | None = None
    admin_notes: str | None
    created_at: datetime
    reviewed_at: datetime | None

    model_config = {"from_attributes": True}


class ClaimedClientAdmin(BaseModel):
    rehab_center_id: int
    center_name: str
    location_display: str
    listing_status: ListingStatus
    client_user_id: int | None = None
    client_name: str | None = None
    client_email: str | None = None
    client_active: bool | None = None
    ticket_number: str | None = None
    job_title: str | None = None
    phone: str | None = None
    claimed_at: datetime | None = None


class ClaimReview(BaseModel):
    status: ClaimStatus
    admin_notes: str = Field(..., min_length=1, description="Required when changing claim status")
    create_client_user: bool = False
    client_password: str | None = Field(default=None, min_length=8)
