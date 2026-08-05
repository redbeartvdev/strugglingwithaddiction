from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class InsuranceCatalog(Base, TimestampMixin):
    """Platform catalog of USA insurance options with logos and coverage-page editorial."""

    __tablename__ = "insurance_catalog"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    logo_path: Mapped[str] = mapped_column(String(512))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    meta_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    meta_description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    hero_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary: Mapped[str | None] = mapped_column(String(512), nullable=True)
    content_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    show_on_hub: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
