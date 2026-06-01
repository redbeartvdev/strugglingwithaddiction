import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ClientPostStatus(str, enum.Enum):
    draft = "draft"
    published = "published"


class ClientLandingPage(Base, TimestampMixin):
    __tablename__ = "client_landing_pages"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    headline: Mapped[str] = mapped_column(String(255), default="")
    about_html: Mapped[str] = mapped_column(Text, default="")
    hero_image_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_published: Mapped[bool] = mapped_column(default=False)
    meta_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    meta_description: Mapped[str | None] = mapped_column(String(512), nullable=True)

    user: Mapped["User"] = relationship(back_populates="landing_page")


class ClientPost(Base, TimestampMixin):
    __tablename__ = "client_posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    slug: Mapped[str] = mapped_column(String(255), index=True)
    title: Mapped[str] = mapped_column(String(500))
    excerpt: Mapped[str] = mapped_column(Text, default="")
    content_html: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[ClientPostStatus] = mapped_column(Enum(ClientPostStatus), default=ClientPostStatus.draft)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
