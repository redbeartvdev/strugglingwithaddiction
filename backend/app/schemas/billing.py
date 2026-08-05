from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class CheckoutRequest(BaseModel):
    interval: str = "month"


class SubscriptionOut(BaseModel):
    status: str
    interval: str | None
    current_period_end: datetime | None
    plan_name: str | None = None
    # Pay-first claim helpers for client portal gating
    payment_ok: bool = False
    listing_claimed: bool = False
    verification_complete: bool = False
    claim_ticket: str | None = None
    claim_status: str | None = None
    payment_failed: bool = False


class SubscriptionPlanOut(BaseModel):
    id: int
    name: str
    stripe_price_id_monthly: str | None
    stripe_price_id_yearly: str | None
    is_active: bool
    features: dict | None

    model_config = {"from_attributes": True}


class SubscriptionPlanUpdate(BaseModel):
    name: str | None = None
    stripe_price_id_monthly: str | None = None
    stripe_price_id_yearly: str | None = None
    is_active: bool | None = None
    features: dict | None = None


class RegisterBillingRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str
    facility_name: str | None = None
    interval: str = "month"


class SubscriberAdmin(BaseModel):
    user_id: int
    email: str
    display_name: str
    status: str
    interval: str | None
    current_period_end: datetime | None
    center_name: str | None = None
    rehab_center_id: int | None = None
    claim_status: str | None = None
    payment_received: bool = False
    listing_claimed: bool = False


class StripeSettingsUpdate(BaseModel):
    enabled: bool | None = None
    secret_key: str | None = None
    webhook_secret: str | None = None
    publishable_key: str | None = None
    price_monthly: str | None = None
    price_yearly: str | None = None
    price_verified_badge: str | None = None
    price_featured_placement: str | None = None
    clear_secret_key: bool = False
    clear_webhook_secret: bool = False


class BillingInvoiceOut(BaseModel):
    id: int
    stripe_invoice_id: str
    number: str | None
    status: str
    amount_due: int
    amount_paid: int
    currency: str
    amount_label: str
    interval: str | None
    period_start: datetime | None
    period_end: datetime | None
    hosted_invoice_url: str | None
    invoice_pdf: str | None
    paid_at: datetime | None
    source: str
    product_label: str | None
    description: str | None
    user_id: int | None
    email: str | None = None
    center_name: str | None = None
    rehab_center_id: int | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
