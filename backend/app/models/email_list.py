from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class EmailListContact(Base, TimestampMixin):
    """A person in the platform mailing-list pool."""

    __tablename__ = "email_list_contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    center_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    continue_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    source: Mapped[str] = mapped_column(String(64), default="", index=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    status: Mapped[str] = mapped_column(String(32), default="subscribed", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    mailchimp_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_event_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    memberships: Mapped[list["MailingListMember"]] = relationship(
        back_populates="contact",
        cascade="all, delete-orphan",
    )


class MailingList(Base, TimestampMixin):
    """A named list contacts can be assigned to and optionally synced to Mailchimp."""

    __tablename__ = "mailing_lists"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    auto_sources: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    mailchimp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    mailchimp_audience_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    mailchimp_tag: Mapped[str | None] = mapped_column(String(100), nullable=True)

    members: Mapped[list["MailingListMember"]] = relationship(
        back_populates="mailing_list",
        cascade="all, delete-orphan",
    )


class MailingListMember(Base, TimestampMixin):
    __tablename__ = "mailing_list_members"
    __table_args__ = (UniqueConstraint("list_id", "contact_id", name="uq_mailing_list_member"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    list_id: Mapped[int] = mapped_column(ForeignKey("mailing_lists.id", ondelete="CASCADE"), index=True)
    contact_id: Mapped[int] = mapped_column(ForeignKey("email_list_contacts.id", ondelete="CASCADE"), index=True)
    mailchimp_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    mailing_list: Mapped[MailingList] = relationship(back_populates="members")
    contact: Mapped[EmailListContact] = relationship(back_populates="memberships")
