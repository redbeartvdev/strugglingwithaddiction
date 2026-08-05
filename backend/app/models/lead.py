from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class CenterLead(Base, TimestampMixin):
    __tablename__ = "center_leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    rehab_center_id: Mapped[int | None] = mapped_column(
        ForeignKey("rehab_centers.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    full_name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    message: Mapped[str] = mapped_column(Text, default="")
    source_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # inquiry | claim_abandonment | submit_abandonment
    source_kind: Mapped[str] = mapped_column(String(64), default="inquiry", index=True)
    # e.g. "abandonment" for abandoned claim/submit journeys
    tag: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # Snapshot of center name (needed when rehab_center_id is null, e.g. submit drafts)
    center_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    center: Mapped["RehabCenter | None"] = relationship(back_populates="leads")  # noqa: F821
