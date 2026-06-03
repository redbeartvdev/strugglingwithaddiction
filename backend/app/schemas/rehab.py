from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.rehab import (
    ClaimStatus,
    FacilityRole,
    ListingStatus,
    CenterSource,
    ListingTier,
    ScrapeJobStatus,
)


class RehabCenterPublic(BaseModel):
    id: int
    slug: str
    name: str
    location: str
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    address_line: str | None = None
    phone: str | None = None
    website: str | None = None
    image: str | None = None
    gallery: list[str] = Field(default_factory=list)
    specialties: list[str]
    treatment_levels: list[str] = Field(default_factory=list)
    insurance_accepted: list[str] = Field(default_factory=list)
    accreditations: list[str] = Field(default_factory=list)
    description: str
    rating: float
    claimed: bool
    listing_tier: ListingTier = ListingTier.free
    is_sponsored: bool = False


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
    image_key: str | None
    image_url: str | None = None
    rating: float
    specialties: list[str]
    claimed: bool
    contact_visible: bool
    listing_status: ListingStatus
    owner_user_id: int | None
    source: CenterSource
    scraped_from_url: str | None
    external_id: str | None = None
    insurance_accepted: list[str] = Field(default_factory=list)
    treatment_levels: list[str] = Field(default_factory=list)
    accreditations: list[str] = Field(default_factory=list)
    gallery_keys: list[str] = Field(default_factory=list)
    listing_tier: ListingTier = ListingTier.free
    is_sponsored: bool = False
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
    image_key: str | None = None
    rating: float = 5.0
    specialties: list[str] = Field(default_factory=list)
    listing_status: ListingStatus = ListingStatus.draft
    source: CenterSource = CenterSource.manual
    external_id: str | None = None
    insurance_accepted: list[str] = Field(default_factory=list)
    treatment_levels: list[str] = Field(default_factory=list)
    accreditations: list[str] = Field(default_factory=list)
    gallery_keys: list[str] = Field(default_factory=list)
    listing_tier: ListingTier = ListingTier.free
    is_sponsored: bool = False
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
    image_key: str | None = None
    rating: float | None = None
    specialties: list[str] | None = None
    claimed: bool | None = None
    contact_visible: bool | None = None
    listing_status: ListingStatus | None = None
    owner_user_id: int | None = None
    external_id: str | None = None
    insurance_accepted: list[str] | None = None
    treatment_levels: list[str] | None = None
    accreditations: list[str] | None = None
    gallery_keys: list[str] | None = None
    listing_tier: ListingTier | None = None
    is_sponsored: bool | None = None
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
    admin_notes: str | None = None
    create_client_user: bool = False
    client_password: str | None = Field(default=None, min_length=8)


class ScrapeResultItem(BaseModel):
    name: str
    address: str = ""
    rating: float | None = None
    services: list[str] = Field(default_factory=list)
    phone: str | None = None
    description: str = ""
    website: str | None = None
    source_url: str | None = None
    state: str | None = None


class ScrapeRequest(BaseModel):
    state: str
    query: str | None = None
    url: str | None = None
    offset: int = Field(default=0, ge=0)


class ScrapeJobOut(BaseModel):
    id: int
    status: ScrapeJobStatus
    query_or_url: str
    state: str | None = None
    results_count: int
    results: list[ScrapeResultItem] = Field(default_factory=list)
    error_log: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ScrapeSettingsOut(BaseModel):
    openai_api_key_set: bool = False
    kimi_api_key_set: bool = False
    claude_api_key_set: bool = False
    gemini_api_key_set: bool = False
    openai_api_key_masked: str | None = None
    kimi_api_key_masked: str | None = None
    claude_api_key_masked: str | None = None
    gemini_api_key_masked: str | None = None
    preferred_provider: str | None = None


class ScrapeSettingsUpdate(BaseModel):
    openai_api_key: str | None = None
    kimi_api_key: str | None = None
    claude_api_key: str | None = None
    gemini_api_key: str | None = None
    preferred_provider: str | None = None


class ScrapeSavedOut(BaseModel):
    id: int
    name: str
    address: str
    rating: float | None
    services: list[str]
    phone: str | None
    description: str
    website: str | None
    source_url: str | None
    state: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
