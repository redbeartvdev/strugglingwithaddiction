"""Resolve Stripe credentials: PlatformStripeSettings (DB) overrides env."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.config import CANONICAL_PUBLIC_SITE_URL, get_settings
from app.models.billing import SubscriptionPlan
from app.models.platform_settings import PlatformStripeSettings

settings = get_settings()

PAYABLE_INVOICE_STATUSES = frozenset({"draft", "open", "unpaid", "past_due"})
UNPAID_INVOICE_STATUSES = frozenset({"draft", "open", "unpaid", "past_due", "uncollectible"})
# Required on this live account (Managed Payments). SaaS — business use.
SWA_PRODUCT_TAX_CODE = "txcd_10103001"


def normalize_stripe_mode(value: str | None) -> str:
    mode = (value or "").strip().lower()
    if mode in ("test", "sandbox"):
        return "test"
    return "live"


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
    mode: str = "live"

    @property
    def configured(self) -> bool:
        return bool(self.enabled and self.secret_key)

    @property
    def prices_ready(self) -> bool:
        return bool(self.price_monthly and self.price_yearly)

    @property
    def webhook_ready(self) -> bool:
        return bool(self.webhook_secret)

    @property
    def livemode(self) -> bool:
        return self.mode == "live"


def get_or_create_stripe_settings(db: Session) -> PlatformStripeSettings:
    row = db.query(PlatformStripeSettings).filter(PlatformStripeSettings.id == 1).first()
    if not row:
        row = PlatformStripeSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def resolve_stripe_config(db: Session | None = None, *, mode: str | None = None) -> StripeConfig:
    """DB values win when non-empty; otherwise fall back to env.

    `mode` overrides the stored/env active mode so webhooks can use the key
    that matches the event (`livemode`) rather than the admin toggle.
    """
    row: PlatformStripeSettings | None = None
    if db is not None:
        row = db.query(PlatformStripeSettings).filter(PlatformStripeSettings.id == 1).first()

    def pick(db_val: str | None, env_val: str) -> str:
        return (db_val or "").strip() or (env_val or "").strip()

    enabled = True if row is None else bool(row.enabled)
    requested = normalize_stripe_mode(
        mode if mode is not None else ((row.mode if row else None) or settings.stripe_mode)
    )
    if requested == "test" and mode is None:
        test_key = pick(row.test_secret_key if row else None, settings.stripe_test_secret_key)
        live_key = pick(row.secret_key if row else None, settings.stripe_secret_key)
        # An admin toggle to sandbox without a test key would take production offline.
        if not test_key and live_key:
            requested = "live"
    active = requested
    if active == "test":
        return StripeConfig(
            secret_key=pick(row.test_secret_key if row else None, settings.stripe_test_secret_key),
            webhook_secret=pick(row.test_webhook_secret if row else None, settings.stripe_test_webhook_secret),
            publishable_key=pick(
                row.test_publishable_key if row else None, settings.stripe_test_publishable_key
            ),
            price_monthly=pick(row.test_price_monthly if row else None, settings.stripe_test_price_monthly),
            price_yearly=pick(row.test_price_yearly if row else None, settings.stripe_test_price_yearly),
            price_verified_badge=pick(
                row.test_price_verified_badge if row else None, settings.stripe_test_price_verified_badge
            ),
            price_featured_placement=pick(
                row.test_price_featured_placement if row else None,
                settings.stripe_test_price_featured_placement,
            ),
            enabled=enabled,
            mode="test",
        )
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
        mode="live",
    )


def mask_secret(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip()
    if len(v) <= 8:
        return "••••••••"
    return f"{v[:4]}…{v[-4:]}"


def _mode_status(cfg: StripeConfig) -> dict[str, Any]:
    return {
        "configured": cfg.configured,
        "prices_ready": cfg.prices_ready,
        "webhook_ready": cfg.webhook_ready,
        "has_secret_key": bool(cfg.secret_key),
        "has_webhook_secret": bool(cfg.webhook_secret),
        "has_publishable_key": bool(cfg.publishable_key),
        "secret_key_masked": mask_secret(cfg.secret_key),
        "webhook_secret_masked": mask_secret(cfg.webhook_secret),
        "publishable_key": cfg.publishable_key or None,
        "price_monthly": cfg.price_monthly or None,
        "price_yearly": cfg.price_yearly or None,
        "price_verified_badge": cfg.price_verified_badge or None,
        "price_featured_placement": cfg.price_featured_placement or None,
    }


def stripe_status_payload(db: Session, *, api_base: str = "", include_account: bool = False) -> dict[str, Any]:
    cfg = resolve_stripe_config(db)
    live = resolve_stripe_config(db, mode="live")
    test = resolve_stripe_config(db, mode="test")
    row = get_or_create_stripe_settings(db)
    live_source = bool(row.secret_key or row.price_monthly or row.price_yearly)
    test_source = bool(row.test_secret_key or row.test_price_monthly or row.test_price_yearly)
    payload = {
        "enabled": cfg.enabled,
        "mode": cfg.mode,
        "livemode": cfg.livemode,
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
        "webhook_url": public_webhook_url(api_base),
        "source": "database" if ((live_source and cfg.mode == "live") or (test_source and cfg.mode == "test")) else "env",
        "live": _mode_status(live),
        "test": _mode_status(test),
        "account": probe_stripe_account(db) if include_account else None,
    }
    return payload


def public_webhook_url(api_base: str = "") -> str:
    """Stripe always posts to the custom domain, never the Railway hostname."""
    return f"{CANONICAL_PUBLIC_SITE_URL.rstrip('/')}/api/billing/webhook"


def checkout_subscription_options(*, user_id: int | str | None = None, extra_metadata: dict | None = None) -> dict[str, Any]:
    """Copy identifying metadata onto the Stripe subscription, not just the session."""
    meta = dict(extra_metadata or {})
    if user_id is not None:
        meta.setdefault("user_id", str(user_id))
    opts: dict[str, Any] = {}
    if meta:
        opts["subscription_data"] = {"metadata": meta}
        ref = meta.get("claim_ticket") or meta.get("user_id")
        if ref:
            opts["client_reference_id"] = str(ref)[:200]
    return opts


def init_stripe_sdk(db: Session | None = None, *, mode: str | None = None):
    """Set stripe.api_key from resolved config. Returns stripe module or None."""
    import stripe

    cfg = resolve_stripe_config(db, mode=mode)
    if not cfg.configured:
        return None
    stripe.api_key = cfg.secret_key
    return stripe


def webhook_secrets(db: Session | None = None) -> list[str]:
    """Secrets for both modes so sandbox and live webhooks can share one URL."""
    found: list[str] = []
    for mode in ("live", "test"):
        secret = resolve_stripe_config(db, mode=mode).webhook_secret
        if secret and secret not in found:
            found.append(secret)
    return found


def construct_stripe_event(db: Session | None, payload: bytes, sig: str):
    import stripe
    from fastapi import HTTPException

    secrets = webhook_secrets(db)
    if not secrets:
        raise HTTPException(status_code=503, detail="Webhook not configured")
    last_error: Exception | None = None
    for secret in secrets:
        try:
            return stripe.Webhook.construct_event(payload, sig, secret)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
    raise HTTPException(status_code=400, detail="Invalid signature") from last_error


def probe_stripe_account(db: Session | None = None, *, mode: str | None = None) -> dict[str, Any]:
    """Confirm the resolved key belongs to the expected live Stripe account."""
    cfg = resolve_stripe_config(db, mode=mode)
    if not cfg.configured:
        return {"ok": False, "error": "Stripe is not configured for this mode. Add the secret key, then test again."}
    st = init_stripe_sdk(db, mode=cfg.mode)
    if not st:
        return {"ok": False, "error": "Stripe is not configured for this mode. Add the secret key, then test again."}
    try:
        st.max_network_retries = 1
        acct = st.Account.retrieve()
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:240]}
    profile = getattr(acct, "business_profile", None)
    display_name = None
    if isinstance(profile, dict):
        display_name = profile.get("name")
    elif profile is not None:
        display_name = getattr(profile, "name", None)
    return {
        "ok": True,
        "id": getattr(acct, "id", None),
        "email": getattr(acct, "email", None),
        "charges_enabled": bool(getattr(acct, "charges_enabled", False)),
        "payouts_enabled": bool(getattr(acct, "payouts_enabled", False)),
        "display_name": display_name,
        "country": getattr(acct, "country", None),
        "livemode": cfg.livemode,
        "mode": cfg.mode,
    }


def sync_subscription_plan_prices(db: Session) -> None:
    """Keep the active Base listing plan on the live Stripe price IDs."""
    live = resolve_stripe_config(db, mode="live")
    if not (live.price_monthly and live.price_yearly):
        return
    plan = (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.is_active.is_(True))
        .order_by(SubscriptionPlan.sort_order, SubscriptionPlan.id)
        .first()
    )
    if not plan:
        return
    if (
        plan.stripe_price_id_monthly == live.price_monthly
        and plan.stripe_price_id_yearly == live.price_yearly
    ):
        return
    plan.stripe_price_id_monthly = live.price_monthly
    plan.stripe_price_id_yearly = live.price_yearly
    db.commit()


def apply_env_stripe_to_settings(db: Session) -> None:
    """Copy env Stripe credentials into empty DB fields so production uses one catalog."""
    row = get_or_create_stripe_settings(db)
    pairs = (
        ("secret_key", settings.stripe_secret_key),
        ("webhook_secret", settings.stripe_webhook_secret),
        ("price_monthly", settings.stripe_price_monthly),
        ("price_yearly", settings.stripe_price_yearly),
        ("price_verified_badge", settings.stripe_price_verified_badge),
        ("price_featured_placement", settings.stripe_price_featured_placement),
        ("test_secret_key", settings.stripe_test_secret_key),
        ("test_webhook_secret", settings.stripe_test_webhook_secret),
        ("test_publishable_key", settings.stripe_test_publishable_key),
        ("test_price_monthly", settings.stripe_test_price_monthly),
        ("test_price_yearly", settings.stripe_test_price_yearly),
        ("test_price_verified_badge", settings.stripe_test_price_verified_badge),
        ("test_price_featured_placement", settings.stripe_test_price_featured_placement),
    )
    changed = False
    for attr, env_val in pairs:
        value = (env_val or "").strip()
        current = (getattr(row, attr) or "").strip()
        if value and not current:
            setattr(row, attr, value)
            changed = True
    if not (row.mode or "").strip():
        row.mode = normalize_stripe_mode(settings.stripe_mode)
        changed = True
    if normalize_stripe_mode(row.mode) == "test" and not (
        (row.test_secret_key or "").strip() or settings.stripe_test_secret_key
    ):
        row.mode = "live"
        changed = True
    if changed:
        db.commit()
    sync_subscription_plan_prices(db)
    st = init_stripe_sdk(db, mode="live")
    if st:
        try:
            ensure_catalog_tax_codes(st)
        except Exception:
            pass
        try:
            ensure_stripe_webhook_endpoint(st)
        except Exception:
            pass


def apply_catalog_prices(db: Session, created: dict[str, str], *, mode: str) -> None:
    row = get_or_create_stripe_settings(db)
    active = normalize_stripe_mode(mode)
    if active == "test":
        row.test_price_monthly = created["price_monthly"]
        row.test_price_yearly = created["price_yearly"]
        row.test_price_verified_badge = created["price_verified_badge"]
        row.test_price_featured_placement = created["price_featured_placement"]
    else:
        row.price_monthly = created["price_monthly"]
        row.price_yearly = created["price_yearly"]
        row.price_verified_badge = created["price_verified_badge"]
        row.price_featured_placement = created["price_featured_placement"]
    db.commit()
    if active == "live":
        sync_subscription_plan_prices(db)


def invoice_is_payable(status: str | None) -> bool:
    return (status or "").lower() in PAYABLE_INVOICE_STATUSES


def invoice_is_unpaid(status: str | None) -> bool:
    return (status or "").lower() in UNPAID_INVOICE_STATUSES


def hosted_pay_url(invoice: Any) -> str | None:
    if not invoice or isinstance(invoice, str):
        return None
    status = invoice.get("status") if isinstance(invoice, dict) else getattr(invoice, "status", None)
    if not invoice_is_payable(status):
        return None
    if isinstance(invoice, dict):
        return invoice.get("hosted_invoice_url") or None
    return getattr(invoice, "hosted_invoice_url", None) or None


def ensure_hosted_invoice_url(st, stripe_invoice_id: str) -> str | None:
    """Finalize a draft if needed and return Stripe's hosted pay/receipt page."""
    if not st or not stripe_invoice_id or str(stripe_invoice_id).startswith("local_"):
        return None
    try:
        invoice = st.Invoice.retrieve(stripe_invoice_id)
    except Exception:
        return None
    status = getattr(invoice, "status", None)
    if status == "draft":
        try:
            invoice = st.Invoice.finalize_invoice(stripe_invoice_id)
        except Exception:
            pass
    url = getattr(invoice, "hosted_invoice_url", None)
    if url:
        return url
    return None


_CATALOG_PRODUCTS = (
    {
        "kind": "base_listing",
        "name": "SWA Base Listing",
        "description": "Claimed directory listing subscription for treatment centers",
        "prices": (
            {
                "key": "price_monthly",
                "interval": "month",
                "unit_amount": 999,
                "nickname": "Base listing monthly",
                "kind": "base_listing_month",
            },
            {
                "key": "price_yearly",
                "interval": "year",
                "unit_amount": 9999,
                "nickname": "Base listing yearly",
                "kind": "base_listing_year",
            },
        ),
    },
    {
        "kind": "verified_badge",
        "name": "Verified / Accredited Badge",
        "description": "Verified badge on directory card and landing page",
        "prices": (
            {
                "key": "price_verified_badge",
                "interval": "month",
                "unit_amount": 19900,
                "nickname": "Verified badge monthly",
                "kind": "verified_badge",
            },
        ),
    },
    {
        "kind": "featured_placement",
        "name": "Featured Placement",
        "description": "Priority placement and Featured badge on the directory",
        "prices": (
            {
                "key": "price_featured_placement",
                "interval": "month",
                "unit_amount": 24900,
                "nickname": "Featured placement monthly",
                "kind": "featured_placement",
            },
        ),
    },
)


def _iter_stripe_list(result):
    if hasattr(result, "auto_paging_iter"):
        yield from result.auto_paging_iter()
        return
    yield from getattr(result, "data", None) or []


def _stripe_get(obj: Any, key: str, default=None):
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    if hasattr(obj, "get"):
        try:
            return obj.get(key, default)
        except TypeError:
            pass
    return getattr(obj, key, default)


STRIPE_WEBHOOK_EVENTS = (
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.subscription.paused",
    "invoice.paid",
    "invoice.payment_failed",
    "invoice.payment_action_required",
    "invoice.finalized",
    "invoice.updated",
    "charge.refunded",
)


def ensure_stripe_webhook_endpoint(st) -> dict[str, str]:
    """Point the live webhook at strugglingwithaddiction.com, not the Railway hostname."""
    if not st:
        raise RuntimeError("Stripe is not configured")
    wanted = public_webhook_url()
    existing = list(_iter_stripe_list(st.WebhookEndpoint.list(limit=100)))
    railway_or_legacy = []
    matching = None
    for endpoint in existing:
        url = str(_stripe_get(endpoint, "url") or "")
        if url.rstrip("/") == wanted.rstrip("/"):
            matching = endpoint
        elif "railway.app" in url or url.rstrip("/").endswith("/api/billing/webhook"):
            railway_or_legacy.append(endpoint)
    target = matching or (railway_or_legacy[0] if railway_or_legacy else None)
    if target:
        st.WebhookEndpoint.modify(
            target.id,
            url=wanted,
            enabled_events=list(STRIPE_WEBHOOK_EVENTS),
        )
        return {"id": target.id, "url": wanted, "secret": None}
    created = st.WebhookEndpoint.create(
        url=wanted,
        enabled_events=list(STRIPE_WEBHOOK_EVENTS),
        description="SWA billing webhook",
    )
    return {
        "id": created.id,
        "url": wanted,
        "secret": getattr(created, "secret", None),
    }


def connect_stripe_account(db: Session, *, secret_key: str, mode: str) -> dict[str, Any]:
    """Save a key, create catalog + webhook, and return status for that mode."""
    key = (secret_key or "").strip()
    active = normalize_stripe_mode(mode)
    if active == "live" and not key.startswith(("sk_live_", "rk_live_")):
        raise ValueError("Production needs a live secret key (sk_live_… or rk_live_…).")
    if active == "test" and not key.startswith(("sk_test_", "rk_test_")):
        raise ValueError("Sandbox needs a test secret key (sk_test_… or rk_test_…). In Stripe, turn on Test mode and copy that key.")

    row = get_or_create_stripe_settings(db)
    row.enabled = True
    if active == "test":
        row.test_secret_key = key
    else:
        row.secret_key = key
        row.mode = "live"
    db.commit()

    st = init_stripe_sdk(db, mode=active)
    if not st:
        raise RuntimeError("Stripe did not accept that key.")
    try:
        st.Account.retrieve()
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Stripe rejected this key: {exc}") from exc

    catalog = provision_stripe_catalog(st)
    apply_catalog_prices(db, catalog, mode=active)
    try:
        ensure_catalog_tax_codes(st)
    except Exception:
        pass
    hook = ensure_stripe_webhook_endpoint(st)
    if hook.get("secret"):
        row = get_or_create_stripe_settings(db)
        if active == "test":
            row.test_webhook_secret = hook["secret"]
        else:
            row.webhook_secret = hook["secret"]
        db.commit()
    try:
        configs = st.billing_portal.Configuration.list(limit=1)
        if not configs.data:
            st.billing_portal.Configuration.create(
                business_profile={"headline": "Struggling With Addiction billing"},
                features={
                    "invoice_history": {"enabled": True},
                    "payment_method_update": {"enabled": True},
                    "customer_update": {"enabled": True, "allowed_updates": ["email", "address"]},
                    "subscription_cancel": {"enabled": True, "mode": "at_period_end"},
                },
            )
    except Exception:
        pass
    return {
        "catalog": catalog,
        "webhook": {"id": hook.get("id"), "url": hook.get("url")},
        "account": probe_stripe_account(db, mode=active),
    }


def stripe_product_data(name: str, **extra: Any) -> dict[str, Any]:
    data = {"name": name, "tax_code": SWA_PRODUCT_TAX_CODE}
    data.update(extra)
    return data


def ensure_catalog_tax_codes(st) -> list[str]:
    """Managed Payments requires a product tax code on SWA catalog products."""
    if not st:
        return []
    names = {spec["name"] for spec in _CATALOG_PRODUCTS}
    kinds = {spec["kind"] for spec in _CATALOG_PRODUCTS}
    updated: list[str] = []
    for product in _iter_stripe_list(st.Product.list(limit=100, active=True)):
        meta = _stripe_get(product, "metadata") or {}
        kind = _stripe_get(meta, "kind")
        name = _stripe_get(product, "name")
        if kind not in kinds and name not in names:
            continue
        current = _stripe_get(product, "tax_code")
        current_id = current if isinstance(current, str) else _stripe_get(current, "id")
        if current_id == SWA_PRODUCT_TAX_CODE:
            continue
        st.Product.modify(product.id, tax_code=SWA_PRODUCT_TAX_CODE)
        updated.append(product.id)
    return updated


def provision_stripe_catalog(st) -> dict[str, str]:
    """Find or create listing + upsell products/prices on the authenticated Stripe account."""
    if not st:
        raise RuntimeError("Stripe is not configured")

    products_by_kind: dict[str, Any] = {}
    products_by_name: dict[str, Any] = {}
    for product in _iter_stripe_list(st.Product.list(limit=100, active=True)):
        meta = _stripe_get(product, "metadata") or {}
        kind = _stripe_get(meta, "kind")
        if kind:
            products_by_kind[str(kind)] = product
        name = _stripe_get(product, "name")
        if name:
            products_by_name[str(name)] = product

    existing_prices = list(_iter_stripe_list(st.Price.list(limit=100, active=True)))
    found: dict[str, str] = {}

    def _prices_for_product(product_id: str) -> list[Any]:
        matched = []
        for price in existing_prices:
            if _stripe_get(price, "product") == product_id:
                matched.append(price)
        return matched

    for spec in _CATALOG_PRODUCTS:
        product = products_by_kind.get(spec["kind"]) or products_by_name.get(spec["name"])
        if not product:
            product = st.Product.create(
                name=spec["name"],
                description=spec["description"],
                tax_code=SWA_PRODUCT_TAX_CODE,
                metadata={"app": "strugglingwithaddiction", "kind": spec["kind"]},
            )
            products_by_kind[spec["kind"]] = product
            products_by_name[spec["name"]] = product
        else:
            patch: dict[str, Any] = {}
            if not _stripe_get(_stripe_get(product, "metadata") or {}, "kind"):
                patch["metadata"] = {"app": "strugglingwithaddiction", "kind": spec["kind"]}
            current_tax = _stripe_get(product, "tax_code")
            current_tax_id = current_tax if isinstance(current_tax, str) else _stripe_get(current_tax, "id")
            if current_tax_id != SWA_PRODUCT_TAX_CODE:
                patch["tax_code"] = SWA_PRODUCT_TAX_CODE
            if patch:
                try:
                    st.Product.modify(product.id, **patch)
                except Exception:
                    pass

        default_price_id = None
        for price_spec in spec["prices"]:
            price_id = None
            for price in _prices_for_product(product.id):
                rec = _stripe_get(price, "recurring") or {}
                interval = _stripe_get(rec, "interval")
                amount = _stripe_get(price, "unit_amount")
                meta = _stripe_get(price, "metadata") or {}
                kind = _stripe_get(meta, "kind")
                if kind == price_spec["kind"] or (
                    interval == price_spec["interval"] and amount == price_spec["unit_amount"]
                ):
                    price_id = _stripe_get(price, "id")
                    break
            if not price_id:
                created_price = st.Price.create(
                    product=product.id,
                    currency="usd",
                    unit_amount=price_spec["unit_amount"],
                    recurring={"interval": price_spec["interval"]},
                    nickname=price_spec["nickname"],
                    metadata={"app": "strugglingwithaddiction", "kind": price_spec["kind"]},
                )
                price_id = created_price.id
                existing_prices.append(created_price)
            found[price_spec["key"]] = price_id
            if price_spec["interval"] == "month" and default_price_id is None:
                default_price_id = price_id
        if default_price_id:
            try:
                st.Product.modify(product.id, default_price=default_price_id)
            except Exception:
                pass

    missing = [
        key
        for key in ("price_monthly", "price_yearly", "price_verified_badge", "price_featured_placement")
        if not found.get(key)
    ]
    if missing:
        raise RuntimeError(f"Stripe catalog missing prices: {', '.join(missing)}")
    ensure_catalog_tax_codes(st)
    return found


def ensure_customer_email(st, customer_id: str | None, email: str | None, name: str | None = None) -> None:
    """Stripe only emails receipts when the customer record has an email."""
    if not st or not customer_id or not email:
        return
    try:
        customer = st.Customer.retrieve(customer_id)
        patch: dict[str, str] = {}
        if not getattr(customer, "email", None):
            patch["email"] = email
        if name and not getattr(customer, "name", None):
            patch["name"] = name
        if patch:
            st.Customer.modify(customer_id, **patch)
    except Exception:
        return


def checkout_receipt_options(*, mode: str, customer_email: str | None = None, metadata: dict | None = None) -> dict[str, Any]:
    """Checkout knobs so Stripe generates hosted invoices and emails receipts."""
    opts: dict[str, Any] = {
        "billing_address_collection": "auto",
        "customer_update": {"name": "auto", "address": "auto"},
    }
    if mode != "payment":
        return opts
    invoice_data: dict[str, Any] = {
        "description": "Struggling With Addiction",
        "footer": "Thank you for supporting Struggling With Addiction. Keep this receipt for your records.",
    }
    if metadata:
        invoice_data["metadata"] = metadata
    opts["invoice_creation"] = {"enabled": True, "invoice_data": invoice_data}
    if customer_email:
        opts["payment_intent_data"] = {"receipt_email": customer_email}
    return opts


def receipt_url_from_invoice(invoice: Any) -> str | None:
    if not invoice or isinstance(invoice, str):
        return None
    if isinstance(invoice, dict):
        return invoice.get("hosted_invoice_url") or invoice.get("invoice_pdf")
    return getattr(invoice, "hosted_invoice_url", None) or getattr(invoice, "invoice_pdf", None)


def receipt_url_from_checkout_session(st, session_id: str | None) -> str | None:
    """Prefer Stripe's hosted invoice page, then the charge receipt URL."""
    if not st or not session_id:
        return None
    try:
        session = st.checkout.Session.retrieve(session_id, expand=["invoice", "payment_intent.latest_charge"])
    except Exception:
        return None

    hosted = receipt_url_from_invoice(getattr(session, "invoice", None))
    if hosted:
        return hosted

    invoice_id = session.get("invoice") if isinstance(session, dict) else getattr(session, "invoice", None)
    if isinstance(invoice_id, str):
        try:
            hosted = receipt_url_from_invoice(st.Invoice.retrieve(invoice_id))
            if hosted:
                return hosted
        except Exception:
            pass

    payment_intent = session.get("payment_intent") if isinstance(session, dict) else getattr(session, "payment_intent", None)
    charge = None
    if payment_intent and not isinstance(payment_intent, str):
        charge = (
            payment_intent.get("latest_charge")
            if isinstance(payment_intent, dict)
            else getattr(payment_intent, "latest_charge", None)
        )
    if charge and not isinstance(charge, str):
        return charge.get("receipt_url") if isinstance(charge, dict) else getattr(charge, "receipt_url", None)
    return None
