"""Resolve Stripe credentials: PlatformStripeSettings (DB) overrides env."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.platform_settings import PlatformStripeSettings

settings = get_settings()


@dataclass
class StripeConfig:
    secret_key: str
    webhook_secret: str
    publishable_key: str
    price_monthly: str
    price_yearly: str
    price_verified_badge: str
    price_featured_placement: str
    enabled: bool

    @property
    def configured(self) -> bool:
        return bool(self.enabled and self.secret_key)

    @property
    def prices_ready(self) -> bool:
        return bool(self.price_monthly and self.price_yearly)

    @property
    def webhook_ready(self) -> bool:
        return bool(self.webhook_secret)


def get_or_create_stripe_settings(db: Session) -> PlatformStripeSettings:
    row = db.query(PlatformStripeSettings).filter(PlatformStripeSettings.id == 1).first()
    if not row:
        row = PlatformStripeSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def resolve_stripe_config(db: Session | None = None) -> StripeConfig:
    """DB values win when non-empty; otherwise fall back to env."""
    row: PlatformStripeSettings | None = None
    if db is not None:
        row = db.query(PlatformStripeSettings).filter(PlatformStripeSettings.id == 1).first()

    def pick(db_val: str | None, env_val: str) -> str:
        return (db_val or "").strip() or (env_val or "").strip()

    enabled = True if row is None else bool(row.enabled)
    return StripeConfig(
        secret_key=pick(row.secret_key if row else None, settings.stripe_secret_key),
        webhook_secret=pick(row.webhook_secret if row else None, settings.stripe_webhook_secret),
        publishable_key=pick(row.publishable_key if row else None, ""),
        price_monthly=pick(row.price_monthly if row else None, settings.stripe_price_monthly),
        price_yearly=pick(row.price_yearly if row else None, settings.stripe_price_yearly),
        price_verified_badge=pick(
            row.price_verified_badge if row else None, settings.stripe_price_verified_badge
        ),
        price_featured_placement=pick(
            row.price_featured_placement if row else None, settings.stripe_price_featured_placement
        ),
        enabled=enabled,
    )


def mask_secret(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip()
    if len(v) <= 8:
        return "••••••••"
    return f"{v[:4]}…{v[-4:]}"


def stripe_status_payload(db: Session, *, api_base: str = "") -> dict[str, Any]:
    cfg = resolve_stripe_config(db)
    row = get_or_create_stripe_settings(db)
    return {
        "enabled": cfg.enabled,
        "configured": cfg.configured,
        "prices_ready": cfg.prices_ready,
        "webhook_ready": cfg.webhook_ready,
        "has_secret_key": bool(cfg.secret_key),
        "has_webhook_secret": bool(cfg.webhook_secret),
        "has_publishable_key": bool(cfg.publishable_key),
        "price_monthly_set": bool(cfg.price_monthly),
        "price_yearly_set": bool(cfg.price_yearly),
        "price_verified_badge_set": bool(cfg.price_verified_badge),
        "price_featured_placement_set": bool(cfg.price_featured_placement),
        "secret_key_masked": mask_secret(cfg.secret_key),
        "webhook_secret_masked": mask_secret(cfg.webhook_secret),
        "publishable_key": cfg.publishable_key or None,
        "price_monthly": cfg.price_monthly or None,
        "price_yearly": cfg.price_yearly or None,
        "price_verified_badge": cfg.price_verified_badge or None,
        "price_featured_placement": cfg.price_featured_placement or None,
        "webhook_url": f"{api_base.rstrip('/')}/api/billing/webhook" if api_base else "/api/billing/webhook",
        "source": "database" if (row.secret_key or row.price_monthly or row.price_yearly) else "env",
    }


def init_stripe_sdk(db: Session | None = None):
    """Set stripe.api_key from resolved config. Returns stripe module or None."""
    import stripe

    cfg = resolve_stripe_config(db)
    if not cfg.configured:
        return None
    stripe.api_key = cfg.secret_key
    return stripe
