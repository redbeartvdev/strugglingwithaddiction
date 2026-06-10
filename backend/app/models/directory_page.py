import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class DirectoryPageType(str, enum.Enum):
    state = "state"
    city = "city"
    topic = "topic"


class DirectoryPageStatus(str, enum.Enum):
    draft = "draft"
    published = "published"


class DirectoryPage(Base, TimestampMixin):
    __tablename__ = "directory_pages"

    id: Mapped[int] = mapped_column(primary_key=True)
    page_type: Mapped[DirectoryPageType] = mapped_column(Enum(DirectoryPageType))
    status: Mapped[DirectoryPageStatus] = mapped_column(
        Enum(DirectoryPageStatus), default=DirectoryPageStatus.draft
    )
    state_slug: Mapped[str] = mapped_column(String(100), index=True)
    city_slug: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(500))
    body_html: Mapped[str] = mapped_column(Text, default="")
    faq_json: Mapped[list | None] = mapped_column(JSONB, default=list)
    meta_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    meta_description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    filter_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    filter_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    filter_insurance: Mapped[str | None] = mapped_column(String(100), nullable=True)
    published_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
