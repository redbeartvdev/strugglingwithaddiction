import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class UpsellProductType(str, enum.Enum):
    """Known product keys with listing-side effects. Catalog may also hold custom keys."""

    verified_badge = "verified_badge"
    featured_placement = "featured_placement"
    featured_article = "featured_article"
    article_aeo = "article_aeo"


class UpsellFulfillment(str, enum.Enum):
    self_serve = "self_serve"
    human = "human"


class UpsellOrderStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    fulfilled = "fulfilled"
    canceled = "canceled"


SYSTEM_PRODUCT_KEYS = frozenset(t.value for t in UpsellProductType)


class UpsellProduct(Base, TimestampMixin):
    """Admin-managed upsell package catalog shown on the client Upsells page."""

    __tablename__ = "upsell_products"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(200))
    price_label: Mapped[str] = mapped_column(String(100))
    amount_cents: Mapped[int] = mapped_column(Integer, default=0)
    fulfillment: Mapped[UpsellFulfillment] = mapped_column(
        Enum(UpsellFulfillment, name="upsellfulfillment", create_constraint=False),
        default=UpsellFulfillment.human,
    )
    description: Mapped[str] = mapped_column(Text, default="")
    detail_text: Mapped[str] = mapped_column(Text, default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    stripe_price_id: Mapped[str | None] = mapped_column(String(255), nullable=True)


class UpsellOrder(Base, TimestampMixin):
    __tablename__ = "upsell_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    rehab_center_id: Mapped[int] = mapped_column(ForeignKey("rehab_centers.id", ondelete="CASCADE"), index=True)
    # String so admin-created custom packages can be ordered (not limited to enum).
    product_type: Mapped[str] = mapped_column(String(64), index=True)
    fulfillment: Mapped[UpsellFulfillment] = mapped_column(
        Enum(UpsellFulfillment, name="upsellfulfillment", create_constraint=False)
    )
    status: Mapped[UpsellOrderStatus] = mapped_column(
        Enum(UpsellOrderStatus, name="upsellorderstatus", create_constraint=False),
        default=UpsellOrderStatus.pending,
    )
    amount_cents: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(10), default="usd")
    stripe_checkout_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    fulfilled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship()  # noqa: F821
    center: Mapped["RehabCenter"] = relationship(back_populates="upsell_orders")  # noqa: F821
