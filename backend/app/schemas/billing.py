from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class CheckoutRequest(BaseModel):
    interval: str = "month"


class SubscriptionOut(BaseModel):
    status: str
    interval: str | None
    current_period_end: datetime | None
    plan_name: str | None = None


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
