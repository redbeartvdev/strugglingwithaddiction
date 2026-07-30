import enum
from datetime import datetime

from sqlalchemy import ARRAY, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class CenterSubmissionStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class CenterSubmission(Base, TimestampMixin):
    """Public “submit your missing center” requests reviewed in Submission Center."""

    __tablename__ = "center_submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255))
    center_name: Mapped[str] = mapped_column(String(255), index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    phone: Mapped[str] = mapped_column(String(50))
    address_line: Mapped[str] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(100))
    zip: Mapped[str | None] = mapped_column(String(20), nullable=True)
    services: Mapped[list[str] | None] = mapped_column(ARRAY(String), default=list)
    insurances: Mapped[list[str] | None] = mapped_column(ARRAY(String), default=list)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[CenterSubmissionStatus] = mapped_column(
        Enum(CenterSubmissionStatus, name="centersubmissionstatus", create_constraint=False),
        default=CenterSubmissionStatus.pending,
        index=True,
    )
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    rehab_center_id: Mapped[int | None] = mapped_column(
        ForeignKey("rehab_centers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    rehab_center: Mapped["RehabCenter | None"] = relationship()  # noqa: F821
    reviewed_by: Mapped["User | None"] = relationship()  # noqa: F821
