from sqlalchemy import ARRAY, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ScrapeSavedItem(Base, TimestampMixin):
    __tablename__ = "scrape_saved_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str] = mapped_column(String(512), default="")
    rating: Mapped[float | None] = mapped_column(Numeric(2, 1), nullable=True)
    services: Mapped[list[str] | None] = mapped_column(ARRAY(String), default=list)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    website: Mapped[str | None] = mapped_column(String(512), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(nullable=True)
