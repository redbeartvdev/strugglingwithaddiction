import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class BillingInterval(str, enum.Enum):
    month = "month"
    year = "year"


class SubscriptionPlan(Base, TimestampMixin):
    __tablename__ = "subscription_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    stripe_price_id_monthly: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_price_id_yearly: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    sort_order: Mapped[int] = mapped_column(default=0)
    features: Mapped[dict | None] = mapped_column(JSONB, default=dict)

    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="plan")


class Subscription(Base, TimestampMixin):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    plan_id: Mapped[int | None] = mapped_column(ForeignKey("subscription_plans.id", ondelete="SET NULL"), nullable=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    interval: Mapped[BillingInterval | None] = mapped_column(Enum(BillingInterval), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="inactive")
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="subscription")
    plan: Mapped["SubscriptionPlan | None"] = relationship(back_populates="subscriptions")


class RegistrationIntent(Base, TimestampMixin):
    __tablename__ = "registration_intents"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255))
    plan_interval: Mapped[BillingInterval] = mapped_column(Enum(BillingInterval))
    stripe_checkout_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


class BillingInvoice(Base, TimestampMixin):
    """Local mirror of Stripe invoices for admin reports and fast lists."""

    __tablename__ = "billing_invoices"

    id: Mapped[int] = mapped_column(primary_key=True)
    stripe_invoice_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    rehab_center_id: Mapped[int | None] = mapped_column(
        ForeignKey("rehab_centers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="open", index=True)
    amount_due: Mapped[int] = mapped_column(Integer, default=0)
    amount_paid: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(16), default="usd")
    interval: Mapped[str | None] = mapped_column(String(16), nullable=True)
    period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hosted_invoice_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    invoice_pdf: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="subscription")  # subscription | upsell
    product_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
