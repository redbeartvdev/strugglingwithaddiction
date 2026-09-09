from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CenterPageView(Base):
    """Public listing page-view events for provider analytics."""

    __tablename__ = "center_page_views"

    id: Mapped[int] = mapped_column(primary_key=True)
    rehab_center_id: Mapped[int] = mapped_column(
        ForeignKey("rehab_centers.id", ondelete="CASCADE"),
        index=True,
    )
    visited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    visitor_state: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    device_type: Mapped[str] = mapped_column(String(32), default="desktop", index=True)
    path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    referrer: Mapped[str | None] = mapped_column(String(512), nullable=True)
    session_key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    center: Mapped["RehabCenter"] = relationship()  # noqa: F821


class CenterInquirySend(Base):
    """Anonymous count of listing inquiries emailed to a rehab provider.

    Stores no visitor name, email, phone, or message — only that a send occurred.
    Visible on that provider's dashboard only.
    """

    __tablename__ = "center_inquiry_sends"

    id: Mapped[int] = mapped_column(primary_key=True)
    rehab_center_id: Mapped[int] = mapped_column(
        ForeignKey("rehab_centers.id", ondelete="CASCADE"),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )

    center: Mapped["RehabCenter"] = relationship()  # noqa: F821


class SitePageView(Base):
    """Public site page-view events for platform (superadmin) analytics."""

    __tablename__ = "site_page_views"

    id: Mapped[int] = mapped_column(primary_key=True)
    visited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    path: Mapped[str] = mapped_column(String(512), index=True)
    page_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    referrer: Mapped[str | None] = mapped_column(String(512), nullable=True)
    visitor_state: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    device_type: Mapped[str] = mapped_column(String(32), default="desktop", index=True)
    session_key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
