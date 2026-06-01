import enum
from datetime import datetime

from sqlalchemy import ARRAY, Boolean, DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ListingStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    hidden = "hidden"


class CenterSource(str, enum.Enum):
    manual = "manual"
    scraped = "scraped"
    imported = "imported"


class ClaimStatus(str, enum.Enum):
    pending = "pending"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"


class FacilityRole(str, enum.Enum):
    owner = "owner"
    director = "director"
    marketing = "marketing"
    staff = "staff"
    other = "other"


class ScrapeJobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class RehabCenter(Base, TimestampMixin):
    __tablename__ = "rehab_centers"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    location_display: Mapped[str] = mapped_column(String(255), default="")
    address_line: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    zip: Mapped[str | None] = mapped_column(String(20), nullable=True)
    lat: Mapped[float | None] = mapped_column(nullable=True)
    lng: Mapped[float | None] = mapped_column(nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(512), nullable=True)
    image_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    rating: Mapped[float] = mapped_column(Numeric(2, 1), default=5.0)
    specialties: Mapped[list[str] | None] = mapped_column(ARRAY(String), default=list)
    claimed: Mapped[bool] = mapped_column(Boolean, default=False)
    contact_visible: Mapped[bool] = mapped_column(Boolean, default=False)
    listing_status: Mapped[ListingStatus] = mapped_column(Enum(ListingStatus), default=ListingStatus.draft)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    owner_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    source: Mapped[CenterSource] = mapped_column(Enum(CenterSource), default=CenterSource.manual)
    scraped_from_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    owner: Mapped["User | None"] = relationship(back_populates="owned_center")
    claims: Mapped[list["RehabCenterClaim"]] = relationship(back_populates="center")


class RehabCenterClaim(Base, TimestampMixin):
    __tablename__ = "rehab_center_claims"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    rehab_center_id: Mapped[int] = mapped_column(ForeignKey("rehab_centers.id", ondelete="CASCADE"))
    submitter_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[ClaimStatus] = mapped_column(Enum(ClaimStatus), default=ClaimStatus.pending)
    full_name: Mapped[str] = mapped_column(String(255))
    job_title: Mapped[str] = mapped_column(String(255))
    work_email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    affiliation_text: Mapped[str] = mapped_column(Text)
    facility_role: Mapped[FacilityRole] = mapped_column(Enum(FacilityRole), default=FacilityRole.other)
    business_license_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    proof_of_affiliation_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    center: Mapped["RehabCenter"] = relationship(back_populates="claims")


class ScrapeJob(Base, TimestampMixin):
    __tablename__ = "scrape_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[ScrapeJobStatus] = mapped_column(Enum(ScrapeJobStatus), default=ScrapeJobStatus.pending)
    query_or_url: Mapped[str] = mapped_column(String(512))
    results_count: Mapped[int] = mapped_column(default=0)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    results_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_log: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
