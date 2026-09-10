from datetime import datetime, timedelta, timezone
from typing import Annotated, Any
import csv
import io
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, Response, StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.core.deps import AdminUser, ClientUser, CurrentUser
from app.core.security import hash_password
from app.database import get_db
from app.models.billing import BillingInterval, BillingInvoice, RegistrationIntent, Subscription, SubscriptionPlan
from app.models.profile import UserProfile
from app.models.rehab import ClaimStatus, RehabCenter, RehabCenterClaim
from app.models.upsell import UpsellOrder, UpsellOrderStatus
from app.models.user import User, UserRole
from app.services.mailchimp import sync_contact
from app.schemas.billing import (
    BillingInvoiceOut,
    CheckoutRequest,
    RegisterBillingRequest,
    StripeSettingsUpdate,
    SubscriberAdmin,
    SubscriptionOut,
    SubscriptionPlanOut,
    SubscriptionPlanUpdate,
)
from app.services.invoice_pdf import InvoicePdfData, build_invoice_pdf
from app.services.simple_pdf import build_simple_pdf
from app.services.stripe_config import (
    apply_catalog_prices,
    checkout_receipt_options,
    checkout_subscription_options,
    construct_stripe_event,
    ensure_customer_email,
    ensure_hosted_invoice_url,
    get_or_create_stripe_settings,
    hosted_pay_url,
    init_stripe_sdk,
    invoice_is_payable,
    invoice_is_unpaid,
    normalize_stripe_mode,
    probe_stripe_account,
    provision_stripe_catalog,
    receipt_url_from_checkout_session,
    receipt_url_from_invoice,
    resolve_stripe_config,
    stripe_product_data,
    stripe_status_payload,
    sync_subscription_plan_prices,
    UNPAID_INVOICE_STATUSES,
)

router = APIRouter(prefix="/api/billing", tags=["billing"])
settings = get_settings()
logger = logging.getLogger("swa.billing")


def _stripe(db: Session | None = None):
    return init_stripe_sdk(db)


def _price_for_interval(db: Session, interval: BillingInterval) -> str:
    cfg = resolve_stripe_config(db)
    price_id = cfg.price_yearly if interval == BillingInterval.year else cfg.price_monthly
    if price_id:
        return price_id
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.is_active.is_(True)).first()
    if plan:
        plan_price = plan.stripe_price_id_yearly if interval == BillingInterval.year else plan.stripe_price_id_monthly
        if plan_price:
            return plan_price
    return ""


def _user_subscription(db: Session, user_id: int) -> Subscription | None:
    return db.query(Subscription).filter(Subscription.user_id == user_id).first()


def _require_stripe_customer(user: User, db: Session) -> tuple[Any, Subscription]:
    st = _stripe(db)
    if not st:
        raise HTTPException(status_code=503, detail="Stripe is not configured. Ask an admin to connect Stripe in Finance settings.")
    sub_row = _user_subscription(db, user.id)
    if not sub_row or not sub_row.stripe_customer_id:
        raise HTTPException(status_code=404, detail="No billing account yet")
    return st, sub_row


def _format_money(amount_cents: int | None, currency: str | None = "usd") -> str:
    cents = int(amount_cents or 0)
    cur = (currency or "usd").upper()
    return f"{cur} {cents / 100:.2f}"


def _invoice_row(inv) -> dict:
    status = getattr(inv, "status", None)
    pay_url = hosted_pay_url(inv)
    return {
        "id": inv.id,
        "number": inv.number or inv.id,
        "status": status,
        "amount_due": inv.amount_due,
        "amount_paid": inv.amount_paid,
        "currency": inv.currency,
        "amount_label": _format_money(inv.amount_paid if status == "paid" else inv.amount_due, inv.currency),
        "created": datetime.fromtimestamp(inv.created, tz=timezone.utc).isoformat() if inv.created else None,
        "period_start": datetime.fromtimestamp(inv.period_start, tz=timezone.utc).isoformat() if getattr(inv, "period_start", None) else None,
        "period_end": datetime.fromtimestamp(inv.period_end, tz=timezone.utc).isoformat() if getattr(inv, "period_end", None) else None,
        "hosted_invoice_url": inv.hosted_invoice_url,
        "invoice_pdf": inv.invoice_pdf,
        "pay_url": pay_url,
        "payable": invoice_is_payable(status),
        "description": (inv.description or (inv.lines.data[0].description if inv.lines and inv.lines.data else None) or "Subscription"),
    }


def _payment_row(charge) -> dict:
    return {
        "id": charge.id,
        "status": charge.status,
        "paid": bool(charge.paid),
        "amount": charge.amount,
        "currency": charge.currency,
        "amount_label": _format_money(charge.amount, charge.currency),
        "created": datetime.fromtimestamp(charge.created, tz=timezone.utc).isoformat() if charge.created else None,
        "description": charge.description or charge.statement_descriptor or "Payment",
        "receipt_url": charge.receipt_url,
        "invoice_id": charge.invoice if isinstance(charge.invoice, str) else (charge.invoice.id if charge.invoice else None),
        "failure_message": charge.failure_message,
    }


def _stripe_timestamp(value) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def _sync_subscription_from_stripe(sub_row: Subscription, payload, *, fallback_active: bool = False) -> None:
    """Map Stripe's subscription shape onto the local subscription row."""
    if not payload:
        if fallback_active:
            sub_row.status = "active"
        return
    sub_row.stripe_subscription_id = payload.get("id") or sub_row.stripe_subscription_id
    status_value = payload.get("status")
    sub_row.status = status_value if status_value in ("active", "trialing", "past_due", "unpaid", "canceled", "paused") else (
        "active" if fallback_active else sub_row.status
    )
    sub_row.current_period_end = _stripe_timestamp(payload.get("current_period_end")) or sub_row.current_period_end


def upsert_billing_invoice(
    db: Session,
    stripe_inv: dict | Any,
    *,
    user_id: int | None = None,
    rehab_center_id: int | None = None,
    source: str = "subscription",
    product_label: str | None = None,
    interval: str | None = None,
) -> BillingInvoice | None:
    """Create or update a local BillingInvoice from a Stripe invoice object/dict."""
    if hasattr(stripe_inv, "to_dict"):
        data = stripe_inv.to_dict()
    elif isinstance(stripe_inv, dict):
        data = stripe_inv
    else:
        data = dict(stripe_inv)

    stripe_id = data.get("id")
    if not stripe_id:
        return None

    customer_id = data.get("customer")
    if not user_id and customer_id:
        sub = db.query(Subscription).filter(Subscription.stripe_customer_id == customer_id).first()
        if sub:
            user_id = sub.user_id
    if not rehab_center_id and user_id:
        center = db.query(RehabCenter).filter(RehabCenter.owner_user_id == user_id).first()
        if center:
            rehab_center_id = center.id

    lines = data.get("lines") or {}
    line_data = lines.get("data") if isinstance(lines, dict) else getattr(lines, "data", None)
    description = data.get("description")
    if not description and line_data:
        first = line_data[0]
        description = first.get("description") if isinstance(first, dict) else getattr(first, "description", None)

    status = data.get("status") or "open"
    paid_at = None
    if status == "paid":
        paid_at = _stripe_timestamp(data.get("status_transitions", {}).get("paid_at") if isinstance(data.get("status_transitions"), dict) else None)
        if not paid_at:
            paid_at = _stripe_timestamp(data.get("created"))

    row = db.query(BillingInvoice).filter(BillingInvoice.stripe_invoice_id == stripe_id).first()
    if not row:
        row = BillingInvoice(stripe_invoice_id=stripe_id)
        db.add(row)

    row.user_id = user_id or row.user_id
    row.rehab_center_id = rehab_center_id or row.rehab_center_id
    row.number = data.get("number") or row.number
    row.status = status
    row.amount_due = int(data.get("amount_due") or 0)
    row.amount_paid = int(data.get("amount_paid") or 0)
    row.currency = (data.get("currency") or "usd").lower()
    row.interval = interval or row.interval
    row.period_start = _stripe_timestamp(data.get("period_start")) or row.period_start
    row.period_end = _stripe_timestamp(data.get("period_end")) or row.period_end
    row.hosted_invoice_url = data.get("hosted_invoice_url") or row.hosted_invoice_url
    row.invoice_pdf = data.get("invoice_pdf") or row.invoice_pdf
    row.paid_at = paid_at or row.paid_at
    row.source = source or row.source
    row.product_label = product_label or row.product_label or description
    row.description = description or row.description
    return row


def _invoice_out(row: BillingInvoice, email: str | None = None, center_name: str | None = None) -> BillingInvoiceOut:
    amount = row.amount_paid if row.status == "paid" else row.amount_due
    return BillingInvoiceOut(
        id=row.id,
        stripe_invoice_id=row.stripe_invoice_id,
        number=row.number,
        status=row.status,
        amount_due=row.amount_due,
        amount_paid=row.amount_paid,
        currency=row.currency,
        amount_label=_format_money(amount, row.currency),
        interval=row.interval,
        period_start=row.period_start,
        period_end=row.period_end,
        hosted_invoice_url=row.hosted_invoice_url,
        invoice_pdf=row.invoice_pdf,
        pay_url=row.hosted_invoice_url if invoice_is_payable(row.status) else None,
        payable=invoice_is_payable(row.status),
        paid_at=row.paid_at,
        source=row.source,
        product_label=row.product_label,
        description=row.description,
        user_id=row.user_id,
        email=email,
        center_name=center_name,
        rehab_center_id=row.rehab_center_id,
        created_at=row.created_at,
    )


def _subscription_out(db: Session, user: User) -> SubscriptionOut:
    sub = _user_subscription(db, user.id)
    center = db.query(RehabCenter).filter(RehabCenter.owner_user_id == user.id).first()
    claim = (
        db.query(RehabCenterClaim)
        .filter(RehabCenterClaim.submitter_user_id == user.id)
        .order_by(RehabCenterClaim.created_at.desc())
        .first()
    )
    status = sub.status if sub else "inactive"
    payment_ok = status in ("active", "trialing", "past_due")
    payment_failed = status in ("past_due", "unpaid")
    listing_claimed = bool(center and center.claimed)
    verification_complete = listing_claimed or (claim and claim.status == ClaimStatus.approved)
    plan_name = sub.plan.name if sub and sub.plan else None
    return SubscriptionOut(
        status=status,
        interval=sub.interval.value if sub and sub.interval else None,
        current_period_end=sub.current_period_end if sub else None,
        plan_name=plan_name,
        payment_ok=payment_ok,
        listing_claimed=listing_claimed,
        verification_complete=bool(verification_complete),
        claim_ticket=claim.ticket_number if claim else None,
        claim_status=claim.status.value if claim else None,
        payment_failed=payment_failed,
    )


@router.get("/plans", response_model=list[SubscriptionPlanOut])
def list_plans(db: Annotated[Session, Depends(get_db)]):
    return db.query(SubscriptionPlan).filter(SubscriptionPlan.is_active.is_(True)).order_by(SubscriptionPlan.sort_order).all()


@router.post("/register")
def register_and_checkout(body: RegisterBillingRequest, db: Annotated[Session, Depends(get_db)]):
    st = _stripe(db)
    if not st:
        raise HTTPException(status_code=503, detail="Stripe is not configured. Ask an admin to connect Stripe in Finance settings.")
    email = body.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email exists")
    user = User(
        email=email,
        password_hash=hash_password(body.password),
        role=UserRole.client,
        is_active=False,
    )
    db.add(user)
    db.flush()
    db.add(UserProfile(user_id=user.id, display_name=body.display_name, slug=f"client-{user.id}"))
    interval = BillingInterval.year if body.interval == "year" else BillingInterval.month
    db.add(RegistrationIntent(email=email, plan_interval=interval, user_id=user.id))
    customer = st.Customer.create(email=email, name=body.display_name, metadata={"user_id": str(user.id)})
    sub_row = Subscription(user_id=user.id, stripe_customer_id=customer.id, status="pending")
    db.add(sub_row)
    price_id = _price_for_interval(db, interval)
    if not price_id:
        raise HTTPException(status_code=503, detail="Stripe price not configured. Set monthly/yearly price IDs in Finance settings.")
    checkout_meta = {"user_id": str(user.id)}
    session = st.checkout.Session.create(
        customer=customer.id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.admin_site_url}/client/billing?success=1",
        cancel_url=f"{settings.admin_site_url}/register?canceled=1",
        metadata=checkout_meta,
        **checkout_subscription_options(user_id=user.id, extra_metadata=checkout_meta),
        **checkout_receipt_options(mode="subscription", customer_email=email, metadata=checkout_meta),
    )
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.is_active.is_(True)).first()
    sub_row.plan_id = plan.id if plan else None
    sub_row.interval = interval
    db.commit()
    sync_contact(
        db,
        email=email,
        source="registration",
        name=body.display_name,
    )
    return {"checkout_url": session.url, "user_id": user.id}


@router.post("/checkout")
def create_checkout(body: CheckoutRequest, user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    st = _stripe(db)
    if not st:
        raise HTTPException(status_code=503, detail="Stripe is not configured. Ask an admin to connect Stripe in Finance settings.")
    sub_row = _user_subscription(db, user.id)
    if not sub_row or not sub_row.stripe_customer_id:
        customer = st.Customer.create(email=user.email)
        sub_row = Subscription(user_id=user.id, stripe_customer_id=customer.id, status="pending")
        db.add(sub_row)
        db.commit()
    ensure_customer_email(st, sub_row.stripe_customer_id, user.email)
    interval = BillingInterval.year if body.interval == "year" else BillingInterval.month
    price_id = _price_for_interval(db, interval)
    if not price_id:
        raise HTTPException(status_code=503, detail="Stripe price not configured. Set monthly/yearly price IDs in Finance settings.")
    checkout_meta = {"user_id": str(user.id)}
    session = st.checkout.Session.create(
        customer=sub_row.stripe_customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.admin_site_url}/client/billing?success=1",
        cancel_url=f"{settings.admin_site_url}/client/billing?canceled=1",
        metadata=checkout_meta,
        **checkout_subscription_options(user_id=user.id, extra_metadata=checkout_meta),
        **checkout_receipt_options(mode="subscription", customer_email=user.email, metadata=checkout_meta),
    )
    sub_row.interval = interval
    db.commit()
    return {"checkout_url": session.url}


@router.get("/subscription", response_model=SubscriptionOut)
def get_subscription(user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    return _subscription_out(db, user)


@router.post("/portal")
def billing_portal(user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    st = _stripe(db)
    if not st:
        raise HTTPException(status_code=503, detail="Stripe is not configured.")
    sub_row = _user_subscription(db, user.id)
    if not sub_row or not sub_row.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account")
    session = st.billing_portal.Session.create(
        customer=sub_row.stripe_customer_id,
        return_url=f"{settings.admin_site_url}/client/billing",
    )
    return {"portal_url": session.url}


@router.get("/invoices")
def list_invoices(user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    """List Stripe invoices for the signed-in provider (prefer live Stripe; fall back to mirror)."""
    st = _stripe(db)
    sub_row = _user_subscription(db, user.id)
    configured = bool(st)
    has_customer = bool(sub_row and sub_row.stripe_customer_id)

    # Ensure this subscriber has at least one local invoice when active
    if sub_row and sub_row.status in ("active", "trialing", "past_due"):
        existing = (
            db.query(BillingInvoice)
            .filter(BillingInvoice.user_id == user.id, BillingInvoice.source == "subscription")
            .first()
        )
        if not existing:
            create_local_invoice_for_subscription(
                db,
                user_id=user.id,
                interval=sub_row.interval.value if sub_row.interval else None,
            )
            db.commit()

    if st and has_customer:
        try:
            invoices = st.Invoice.list(customer=sub_row.stripe_customer_id, limit=50)
            for inv in invoices.data:
                upsert_billing_invoice(db, inv, user_id=user.id, interval=sub_row.interval.value if sub_row.interval else None)
            db.commit()
            return {
                "invoices": [_invoice_row(inv) for inv in invoices.data],
                "stripe_configured": True,
                "has_customer": True,
            }
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Unable to load invoices: {exc}") from exc

    # Local mirror fallback
    rows = (
        db.query(BillingInvoice)
        .filter(BillingInvoice.user_id == user.id)
        .order_by(BillingInvoice.paid_at.desc().nullslast(), BillingInvoice.id.desc())
        .limit(50)
        .all()
    )
    return {
        "invoices": [
            {
                "id": str(r.id),
                "number": r.number or r.stripe_invoice_id,
                "status": r.status,
                "amount_due": r.amount_due,
                "amount_paid": r.amount_paid,
                "currency": r.currency,
                "amount_label": _format_money(r.amount_paid if r.status == "paid" else r.amount_due, r.currency),
                "created": (r.paid_at or r.created_at).isoformat() if (r.paid_at or r.created_at) else None,
                "period_start": r.period_start.isoformat() if r.period_start else None,
                "period_end": r.period_end.isoformat() if r.period_end else None,
                "hosted_invoice_url": r.hosted_invoice_url,
                "invoice_pdf": r.invoice_pdf,
                "pay_url": r.hosted_invoice_url if invoice_is_payable(r.status) else None,
                "payable": invoice_is_payable(r.status),
                "description": r.description or r.product_label or "Subscription",
                "download_path": f"/api/billing/invoices/{r.id}/pdf",
            }
            for r in rows
        ],
        "stripe_configured": configured,
        "has_customer": has_customer or bool(rows),
    }


@router.get("/payments")
def list_payments(user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    st = _stripe(db)
    sub_row = _user_subscription(db, user.id)
    if not st or not sub_row or not sub_row.stripe_customer_id:
        return {"payments": [], "stripe_configured": bool(st), "has_customer": bool(sub_row and sub_row.stripe_customer_id)}
    try:
        charges = st.Charge.list(customer=sub_row.stripe_customer_id, limit=50)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Unable to load payments: {exc}") from exc
    return {
        "payments": [_payment_row(ch) for ch in charges.data],
        "stripe_configured": True,
        "has_customer": True,
    }


def _find_user_invoice(db: Session, user_id: int, invoice_id: str) -> BillingInvoice | None:
    if invoice_id.isdigit():
        return (
            db.query(BillingInvoice)
            .filter(BillingInvoice.id == int(invoice_id), BillingInvoice.user_id == user_id)
            .first()
        )
    return (
        db.query(BillingInvoice)
        .filter(BillingInvoice.stripe_invoice_id == invoice_id, BillingInvoice.user_id == user_id)
        .first()
    )


def _pay_url_for_invoice(st, db: Session, row: BillingInvoice | None, *, stripe_invoice_id: str | None, customer_id: str | None, user_email: str | None) -> str:
    stripe_id = stripe_invoice_id or (row.stripe_invoice_id if row else None)
    if st and stripe_id and not str(stripe_id).startswith("local_"):
        url = ensure_hosted_invoice_url(st, stripe_id)
        if url:
            if row and row.hosted_invoice_url != url:
                row.hosted_invoice_url = url
                db.commit()
            return url
    if row and invoice_is_payable(row.status) and row.hosted_invoice_url:
        return row.hosted_invoice_url
    if st and customer_id and row and invoice_is_payable(row.status) and int(row.amount_due or row.amount_paid or 0) > 0:
        ensure_customer_email(st, customer_id, user_email)
        checkout = st.checkout.Session.create(
            customer=customer_id,
            mode="payment",
            line_items=[
                {
                    "quantity": 1,
                    "price_data": {
                        "currency": row.currency or "usd",
                        "unit_amount": int(row.amount_due or row.amount_paid or 0),
                        "product_data": stripe_product_data(row.product_label or row.description or "Invoice"),
                    },
                }
            ],
            success_url=f"{settings.admin_site_url}/client/billing?paid=1",
            cancel_url=f"{settings.admin_site_url}/client/billing?canceled=1",
            metadata={"local_invoice_id": str(row.id), "user_id": str(row.user_id or "")},
            **checkout_receipt_options(mode="payment", customer_email=user_email),
        )
        if checkout.url:
            return checkout.url
    if st and customer_id:
        session = st.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{settings.admin_site_url}/client/billing",
        )
        return session.url
    raise HTTPException(status_code=404, detail="No Stripe pay link is available for this invoice")


@router.post("/invoices/{invoice_id}/pay")
def pay_invoice(invoice_id: str, user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    """Return a Stripe hosted invoice (or portal) URL so the provider can pay a failed/open invoice."""
    st = _stripe(db)
    sub_row = _user_subscription(db, user.id)
    row = _find_user_invoice(db, user.id, invoice_id)
    stripe_id = invoice_id if not invoice_id.isdigit() else (row.stripe_invoice_id if row else None)
    if st and stripe_id and not str(stripe_id).startswith("local_"):
        try:
            inv = st.Invoice.retrieve(stripe_id)
            if sub_row and sub_row.stripe_customer_id and inv.customer != sub_row.stripe_customer_id:
                raise HTTPException(status_code=403, detail="Invoice does not belong to this account")
            if not invoice_is_payable(inv.status):
                raise HTTPException(status_code=400, detail="This invoice is not payable")
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            if not row:
                raise HTTPException(status_code=404, detail="Invoice not found") from exc
    elif row and not invoice_is_payable(row.status):
        raise HTTPException(status_code=400, detail="This invoice is not payable")
    elif not row and not (st and stripe_id):
        raise HTTPException(status_code=404, detail="Invoice not found")
    pay_url = _pay_url_for_invoice(
        st,
        db,
        row,
        stripe_invoice_id=stripe_id,
        customer_id=sub_row.stripe_customer_id if sub_row else None,
        user_email=user.email,
    )
    return {"pay_url": pay_url, "kind": "stripe"}


@router.get("/invoices/{invoice_id}/pdf")
def download_invoice_pdf(invoice_id: str, user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    """Download invoice PDF — Stripe official PDF or generated local PDF."""
    # Local mirror by numeric id (works without Stripe)
    if invoice_id.isdigit():
        local = (
            db.query(BillingInvoice)
            .filter(BillingInvoice.id == int(invoice_id), BillingInvoice.user_id == user.id)
            .first()
        )
        if local:
            if local.invoice_pdf and not str(local.stripe_invoice_id).startswith("local_"):
                return RedirectResponse(url=local.invoice_pdf)
            pdf = _build_invoice_pdf_bytes(db, local)
            filename = f"{local.number or local.stripe_invoice_id}.pdf".replace(" ", "-")
            return Response(
                content=pdf,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )

    local_by_stripe = (
        db.query(BillingInvoice)
        .filter(BillingInvoice.stripe_invoice_id == invoice_id, BillingInvoice.user_id == user.id)
        .first()
    )
    if local_by_stripe and str(invoice_id).startswith("local_"):
        pdf = _build_invoice_pdf_bytes(db, local_by_stripe)
        filename = f"{local_by_stripe.number or invoice_id}.pdf".replace(" ", "-")
        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    st, sub_row = _require_stripe_customer(user, db)
    try:
        inv = st.Invoice.retrieve(invoice_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail="Invoice not found") from exc
    if inv.customer != sub_row.stripe_customer_id:
        raise HTTPException(status_code=403, detail="Invoice does not belong to this account")
    if not inv.invoice_pdf:
        raise HTTPException(status_code=404, detail="PDF not available for this invoice yet")
    return RedirectResponse(url=inv.invoice_pdf)


@router.get("/history.pdf")
def download_billing_history_pdf(user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    st = _stripe(db)
    sub_row = _user_subscription(db, user.id)
    lines = [
        f"Account: {user.email}",
        f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "INVOICES",
        "-" * 72,
    ]
    invoices: list[Any] = []
    payments: list[Any] = []
    if st and sub_row and sub_row.stripe_customer_id:
        try:
            invoices = st.Invoice.list(customer=sub_row.stripe_customer_id, limit=50).data
            payments = st.Charge.list(customer=sub_row.stripe_customer_id, limit=50).data
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Unable to build history PDF: {exc}") from exc

    if not invoices:
        lines.append("No invoices found.")
    else:
        for inv in invoices:
            row = _invoice_row(inv)
            created = (row["created"] or "")[:10]
            lines.append(f"{created}  {row['number']}  {row['status']}  {row['amount_label']}  {row['description']}")

    lines.extend(["", "PAYMENT HISTORY", "-" * 72])
    if not payments:
        lines.append("No payments found.")
    else:
        for ch in payments:
            row = _payment_row(ch)
            created = (row["created"] or "")[:10]
            lines.append(f"{created}  {row['id']}  {row['status']}  {row['amount_label']}  {row['description']}")

    pdf = build_simple_pdf("SWA Studio — Billing History", lines)
    filename = f"swa-billing-history-{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/stripe-health")
def stripe_health(db: Annotated[Session, Depends(get_db)]):
    """Public readiness check — no secrets. Used to confirm production has Stripe wired."""
    cfg = resolve_stripe_config(db)
    return {
        "configured": cfg.configured,
        "prices_ready": cfg.prices_ready,
        "webhook_ready": cfg.webhook_ready,
        "mode": cfg.mode,
    }


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Annotated[Session, Depends(get_db)]):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    event = construct_stripe_event(db, payload, sig)
    st = init_stripe_sdk(db, mode="live" if event["livemode"] else "test")
    if not st:
        raise HTTPException(status_code=503, detail="Stripe is not configured for this event mode")

    from app.api.claim_journey import downgrade_center_after_cancel, record_payment_on_claim
    from app.models.upsell import UpsellProductType
    from app.services.email import send_email

    etype = event["type"]
    data = event["data"]["object"]
    checkout_paid = etype in ("checkout.session.completed", "checkout.session.async_payment_succeeded")

    if checkout_paid or etype in ("customer.subscription.updated", "customer.subscription.created"):
        user_id = None
        meta = data.get("metadata") or {}
        if meta.get("user_id"):
            user_id = int(meta["user_id"])
        customer_id = data.get("customer")
        sub_row = None
        if user_id:
            sub_row = _user_subscription(db, user_id)
        elif customer_id:
            sub_row = db.query(Subscription).filter(Subscription.stripe_customer_id == customer_id).first()
            if sub_row:
                user_id = sub_row.user_id
        if sub_row and user_id:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.is_active = True
            if checkout_paid:
                subscription_payload = None
                subscription_id = data.get("subscription")
                if subscription_id:
                    try:
                        subscription_payload = st.Subscription.retrieve(subscription_id)
                    except Exception:
                        subscription_payload = None
                if data.get("mode") != "payment":
                    _sync_subscription_from_stripe(sub_row, subscription_payload, fallback_active=True)
            else:
                _sync_subscription_from_stripe(sub_row, data)

            if etype == "customer.subscription.updated" and data.get("cancel_at_period_end") and user:
                center = db.query(RehabCenter).filter(RehabCenter.owner_user_id == user_id).first()
                if center:
                    access_end = (
                        sub_row.current_period_end.strftime("%b %-d, %Y")
                        if sub_row.current_period_end
                        else "the end of your paid period"
                    )
                    send_email(
                        db,
                        to_email=user.email,
                        template_key="cancellation",
                        context={
                            "name": user.email,
                            "center_name": center.name,
                            "access_end": access_end,
                            "billing_url": f"{settings.admin_site_url}/client/billing",
                        },
                        user_id=user.id,
                        rehab_center_id=center.id,
                    )

            if etype == "customer.subscription.updated" and sub_row.status == "unpaid":
                center = db.query(RehabCenter).filter(RehabCenter.owner_user_id == user_id).first()
                if center and center.claimed:
                    downgrade_center_after_cancel(db, user_id, send_winback=True)

            if meta.get("upsell_order_id"):
                order = db.query(UpsellOrder).filter(UpsellOrder.id == int(meta["upsell_order_id"])).first()
                if order:
                    order.status = UpsellOrderStatus.paid
                    center = db.query(RehabCenter).filter(RehabCenter.id == order.rehab_center_id).first()
                    if center and order.product_type == UpsellProductType.verified_badge:
                        center.verified_badge = True
                    if center and order.product_type == UpsellProductType.featured_placement:
                        from datetime import datetime as dt
                        center.featured_until = dt.now(timezone.utc) + timedelta(days=30)
                    if user:
                        product_label = order.product_type.value.replace("_", " ").title()
                        send_email(
                            db,
                            to_email=user.email,
                            template_key="upsell_receipt",
                            context={
                                "name": user.email,
                                "center_name": center.name if center else "your listing",
                                "product_label": product_label,
                                "amount": f"${(order.amount_cents or 0) / 100:.2f}",
                                "order_id": str(order.id),
                                "login_url": f"{settings.public_site_url.rstrip('/')}/portal",
                                "billing_url": f"{settings.admin_site_url}/client/billing",
                                "receipt_url": receipt_url_from_checkout_session(st, data.get("id"))
                                or f"{settings.admin_site_url}/client/billing",
                            },
                            user_id=user.id,
                            rehab_center_id=order.rehab_center_id,
                        )
            elif checkout_paid and data.get("mode") != "payment" and not meta.get("local_invoice_id"):
                # Pay-first listing checkout. Skip one-time invoice pay sessions.
                record_payment_on_claim(
                    db,
                    user_id=user_id,
                    claim_ticket=meta.get("claim_ticket"),
                    rehab_center_id=int(meta["rehab_center_id"]) if meta.get("rehab_center_id") else None,
                )
                if not data.get("invoice"):
                    create_local_invoice_for_subscription(
                        db,
                        user_id=user_id,
                        interval=sub_row.interval.value if sub_row.interval else None,
                        rehab_center_id=int(meta["rehab_center_id"]) if meta.get("rehab_center_id") else None,
                    )
                if user:
                    amount_label = "$99.99" if sub_row.interval == BillingInterval.year else "$9.99"
                    stripe_receipt = receipt_url_from_checkout_session(st, data.get("id"))
                    send_email(
                        db,
                        to_email=user.email,
                        template_key="payment_receipt",
                        context={
                            "name": user.email,
                            "center_name": "your listing",
                            "amount": amount_label,
                            "receipt_url": stripe_receipt or f"{settings.admin_site_url}/client/billing",
                            "billing_url": f"{settings.admin_site_url}/client/billing",
                        },
                        user_id=user.id,
                    )

    elif etype in (
        "invoice.paid",
        "invoice.payment_failed",
        "invoice.payment_action_required",
        "invoice.finalized",
        "invoice.updated",
    ):
        customer_id = data.get("customer")
        sub_row = db.query(Subscription).filter(Subscription.stripe_customer_id == customer_id).first() if customer_id else None
        interval = sub_row.interval.value if sub_row and sub_row.interval else None
        upsert_billing_invoice(
            db,
            data,
            user_id=sub_row.user_id if sub_row else None,
            source="subscription",
            product_label="Listing subscription",
            interval=interval,
        )
        if etype == "invoice.paid":
            billing_reason = data.get("billing_reason") or ""
            # Renew monthly upsell entitlements (verified badge / featured placement).
            subscription_id = data.get("subscription")
            if subscription_id and st:
                try:
                    stripe_sub = st.Subscription.retrieve(subscription_id)
                    smeta = stripe_sub.get("metadata") or {}
                    product_type = smeta.get("product_type")
                    center_id = smeta.get("rehab_center_id")
                    if product_type and center_id:
                        from app.models.upsell import UpsellProductType as _UPT
                        from datetime import datetime as dt

                        center = db.query(RehabCenter).filter(RehabCenter.id == int(center_id)).first()
                        if center and product_type == _UPT.verified_badge.value:
                            center.verified_badge = True
                        if center and product_type == _UPT.featured_placement.value:
                            center.featured_until = dt.now(timezone.utc) + timedelta(days=32)
                        if center:
                            db.commit()
                except Exception:
                    logger.exception("Failed to renew upsell entitlement for subscription %s", subscription_id)

            if sub_row and billing_reason in ("subscription_cycle", "subscription_update"):
                user = db.query(User).filter(User.id == sub_row.user_id).first()
                center = db.query(RehabCenter).filter(RehabCenter.owner_user_id == sub_row.user_id).first()
                amount = data.get("amount_paid")
                amount_label = f"${amount / 100:.2f}" if isinstance(amount, int) else "$9.99"
                renewal = (
                    sub_row.current_period_end.strftime("%b %-d, %Y")
                    if sub_row.current_period_end
                    else ""
                )
                if user:
                    send_email(
                        db,
                        to_email=user.email,
                        template_key="subscription_renewed",
                        context={
                            "name": user.email,
                            "center_name": center.name if center else "your listing",
                            "amount": amount_label,
                            "renewal_date": renewal,
                            "billing_url": f"{settings.admin_site_url}/client/billing",
                            "receipt_url": receipt_url_from_invoice(data)
                            or f"{settings.admin_site_url}/client/billing",
                        },
                        user_id=user.id,
                        rehab_center_id=center.id if center else None,
                    )
        elif etype == "invoice.payment_failed":
            if sub_row:
                if sub_row.status not in ("canceled", "unpaid"):
                    sub_row.status = "past_due"
                user = db.query(User).filter(User.id == sub_row.user_id).first()
                center = db.query(RehabCenter).filter(RehabCenter.owner_user_id == sub_row.user_id).first()
                pay_url = data.get("hosted_invoice_url") or (
                    f"{settings.admin_site_url}/client/billing"
                )
                amount = data.get("amount_due") or data.get("amount_remaining")
                amount_label = f"${amount / 100:.2f}" if isinstance(amount, int) else ""
                attempt = data.get("attempt_count") or 1
                if user:
                    send_email(
                        db,
                        to_email=user.email,
                        template_key="dunning",
                        context={
                            "name": user.email,
                            "center_name": center.name if center else "your listing",
                            "billing_url": f"{settings.admin_site_url}/client/billing",
                            "pay_url": pay_url,
                            "amount": amount_label,
                            "attempt_count": str(attempt),
                        },
                        user_id=user.id,
                        rehab_center_id=center.id if center else None,
                        respect_preferences=False,
                    )
                from app.services.email import resolve_email_delivery

                ops_email = resolve_email_delivery(db).get("ops_email")
                if ops_email and (not user or ops_email.lower() != user.email.lower()):
                    send_email(
                        db,
                        to_email=ops_email,
                        template_key="payment_failed_admin",
                        context={
                            "name": "Admin",
                            "email": user.email if user else "",
                            "center_name": center.name if center else "a listing",
                            "amount": amount_label,
                            "pay_url": pay_url,
                            "attempt_count": str(attempt),
                            "billing_url": f"{settings.admin_site_url}/client/billing",
                            "admin_invoices_url": f"{settings.admin_site_url}/admin/billing",
                        },
                        rehab_center_id=center.id if center else None,
                        respect_preferences=False,
                    )

    elif etype in ("customer.subscription.deleted", "customer.subscription.paused"):
        customer_id = data.get("customer")
        sub_row = db.query(Subscription).filter(Subscription.stripe_customer_id == customer_id).first() if customer_id else None
        if sub_row:
            sub_row.status = "canceled" if etype.endswith("deleted") else "paused"
            user = db.query(User).filter(User.id == sub_row.user_id).first()
            center = db.query(RehabCenter).filter(RehabCenter.owner_user_id == sub_row.user_id).first()
            if user and center:
                send_email(
                    db,
                    to_email=user.email,
                    template_key="cancellation",
                    context={
                        "name": user.email,
                        "center_name": center.name,
                        "access_end": "the end of your paid period",
                        "billing_url": f"{settings.admin_site_url}/client/billing",
                    },
                    user_id=user.id,
                    rehab_center_id=center.id,
                )
            if etype == "customer.subscription.deleted":
                downgrade_center_after_cancel(db, sub_row.user_id, send_winback=True)

    elif etype == "checkout.session.async_payment_failed":
        customer_id = data.get("customer")
        sub_row = db.query(Subscription).filter(Subscription.stripe_customer_id == customer_id).first() if customer_id else None
        invoice_id = data.get("invoice")
        if invoice_id and st:
            try:
                inv = st.Invoice.retrieve(invoice_id) if isinstance(invoice_id, str) else invoice_id
                upsert_billing_invoice(
                    db,
                    inv,
                    user_id=sub_row.user_id if sub_row else None,
                    source="subscription",
                    product_label="Listing subscription",
                )
            except Exception:
                logger.exception("Failed to mirror async failed checkout invoice %s", invoice_id)
        if sub_row and sub_row.status not in ("canceled", "unpaid"):
            sub_row.status = "past_due"

    elif etype == "charge.refunded":
        invoice_id = data.get("invoice")
        if invoice_id:
            row = db.query(BillingInvoice).filter(BillingInvoice.stripe_invoice_id == invoice_id).first()
            if row and row.status == "paid":
                row.status = "void"

    db.commit()
    return {"received": True}


# ── Admin Finance ──────────────────────────────────────────────────────────


@router.get("/admin/subscribers", response_model=list[SubscriberAdmin])
def admin_subscribers(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    subs = db.query(Subscription).all()
    result = []
    for s in subs:
        user = db.query(User).filter(User.id == s.user_id).first()
        profile = db.query(UserProfile).filter(UserProfile.user_id == s.user_id).first()
        center = db.query(RehabCenter).filter(RehabCenter.owner_user_id == s.user_id).first()
        claim = (
            db.query(RehabCenterClaim)
            .filter(RehabCenterClaim.submitter_user_id == s.user_id)
            .order_by(RehabCenterClaim.created_at.desc())
            .first()
        )
        result.append(
            SubscriberAdmin(
                user_id=s.user_id,
                email=user.email if user else "",
                display_name=profile.display_name if profile else "",
                status=s.status,
                interval=s.interval.value if s.interval else None,
                current_period_end=s.current_period_end,
                center_name=center.name if center else None,
                rehab_center_id=center.id if center else None,
                claim_status=claim.status.value if claim else None,
                payment_received=bool(claim and claim.payment_received_at) or s.status in ("active", "trialing", "past_due"),
                listing_claimed=bool(center and center.claimed),
            )
        )
    return result


@router.get("/admin/overview")
def admin_finance_overview(_: AdminUser, db: Annotated[Session, Depends(get_db)], days: int = Query(30, ge=1, le=365)):
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    active_subs = db.query(Subscription).filter(Subscription.status.in_(("active", "trialing", "past_due"))).all()
    mrr_cents = 0
    monthly_count = 0
    yearly_count = 0
    for s in active_subs:
        if s.interval == BillingInterval.year:
            mrr_cents += int(9999 / 12)  # $99.99/yr
            yearly_count += 1
        else:
            mrr_cents += 999  # $9.99
            monthly_count += 1

    unpaid = (
        db.query(Subscription)
        .filter(Subscription.status.in_(("pending", "past_due", "unpaid", "inactive")))
        .count()
    )
    past_due = db.query(Subscription).filter(Subscription.status == "past_due").count()

    new_claimed = (
        db.query(RehabCenter)
        .filter(RehabCenter.claimed.is_(True), RehabCenter.updated_at >= since)
        .count()
    )
    newly_verified = (
        db.query(RehabCenterClaim)
        .filter(
            RehabCenterClaim.cert_verified_at.isnot(None),
            RehabCenterClaim.cert_verified_at >= since,
            RehabCenterClaim.payment_received_at.isnot(None),
        )
        .count()
    )
    paid_awaiting_verify = (
        db.query(RehabCenterClaim)
        .filter(
            RehabCenterClaim.payment_received_at.isnot(None),
            RehabCenterClaim.status.in_((ClaimStatus.pending, ClaimStatus.under_review, ClaimStatus.certified)),
        )
        .count()
    )

    upgrade_paid = (
        db.query(func.coalesce(func.sum(UpsellOrder.amount_cents), 0))
        .filter(UpsellOrder.status.in_((UpsellOrderStatus.paid, UpsellOrderStatus.fulfilled)))
        .scalar()
    )
    upgrade_period = (
        db.query(func.coalesce(func.sum(UpsellOrder.amount_cents), 0))
        .filter(
            UpsellOrder.status.in_((UpsellOrderStatus.paid, UpsellOrderStatus.fulfilled)),
            UpsellOrder.created_at >= since,
        )
        .scalar()
    )
    invoice_revenue = (
        db.query(func.coalesce(func.sum(BillingInvoice.amount_paid), 0))
        .filter(BillingInvoice.status == "paid", BillingInvoice.paid_at >= since)
        .scalar()
    )

    return {
        "period_days": days,
        "mrr_cents": mrr_cents,
        "mrr_label": _format_money(mrr_cents),
        "arr_cents": mrr_cents * 12,
        "arr_label": _format_money(mrr_cents * 12),
        "active_subscribers": len(active_subs),
        "monthly_subscribers": monthly_count,
        "yearly_subscribers": yearly_count,
        "unpaid_count": unpaid,
        "past_due_count": past_due,
        "new_claimed": new_claimed,
        "newly_verified": newly_verified,
        "paid_awaiting_verification": paid_awaiting_verify,
        "upgrade_revenue_cents": int(upgrade_paid or 0),
        "upgrade_revenue_label": _format_money(int(upgrade_paid or 0)),
        "upgrade_period_cents": int(upgrade_period or 0),
        "upgrade_period_label": _format_money(int(upgrade_period or 0)),
        "invoice_period_cents": int(invoice_revenue or 0),
        "invoice_period_label": _format_money(int(invoice_revenue or 0)),
        "stripe": stripe_status_payload(
            db,
            api_base=(
                settings.admin_site_url.replace(":5180", ":8317")
                if "5180" in settings.admin_site_url
                else settings.admin_site_url.replace(":5318", ":8317")
                if "5318" in settings.admin_site_url
                else ""
            ),
        ),
    }


@router.get("/admin/unpaid")
def admin_unpaid(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    """Subscriptions not actively paid + claims awaiting payment."""
    rows = []
    subs = db.query(Subscription).filter(Subscription.status.in_(("pending", "past_due", "unpaid", "inactive"))).all()
    for s in subs:
        user = db.query(User).filter(User.id == s.user_id).first()
        profile = db.query(UserProfile).filter(UserProfile.user_id == s.user_id).first()
        center = db.query(RehabCenter).filter(RehabCenter.owner_user_id == s.user_id).first()
        claim = (
            db.query(RehabCenterClaim)
            .filter(RehabCenterClaim.submitter_user_id == s.user_id)
            .order_by(RehabCenterClaim.created_at.desc())
            .first()
        )
        rows.append({
            "kind": "subscription",
            "user_id": s.user_id,
            "email": user.email if user else "",
            "display_name": profile.display_name if profile else "",
            "status": s.status,
            "interval": s.interval.value if s.interval else None,
            "current_period_end": s.current_period_end.isoformat() if s.current_period_end else None,
            "center_name": center.name if center else None,
            "claim_status": claim.status.value if claim else None,
            "ticket_number": claim.ticket_number if claim else None,
        })

    # Claims started but not paid
    claims = (
        db.query(RehabCenterClaim)
        .options(joinedload(RehabCenterClaim.center))
        .filter(
            RehabCenterClaim.payment_received_at.is_(None),
            RehabCenterClaim.status.in_((ClaimStatus.pending, ClaimStatus.under_review, ClaimStatus.certified)),
        )
        .all()
    )
    seen_users = {r["user_id"] for r in rows}
    for c in claims:
        if c.submitter_user_id and c.submitter_user_id in seen_users:
            continue
        rows.append({
            "kind": "claim_unpaid",
            "user_id": c.submitter_user_id,
            "email": c.work_email,
            "display_name": c.full_name,
            "status": "awaiting_payment",
            "interval": None,
            "current_period_end": None,
            "center_name": c.center.name if c.center else None,
            "claim_status": c.status.value,
            "ticket_number": c.ticket_number,
        })
    return {"items": rows}


def _subscription_amount_cents(sub: Subscription) -> int:
    if sub.interval == BillingInterval.year:
        return 9999  # $99.99
    return 999  # $9.99


def _ensure_local_invoices(db: Session) -> int:
    """Create local invoice rows for active subscribers that have none yet (dev / pre-Stripe)."""
    created = 0
    subs = db.query(Subscription).filter(Subscription.status.in_(("active", "trialing", "past_due"))).all()
    for sub in subs:
        existing = (
            db.query(BillingInvoice)
            .filter(BillingInvoice.user_id == sub.user_id, BillingInvoice.source == "subscription")
            .first()
        )
        if existing:
            continue
        center = db.query(RehabCenter).filter(RehabCenter.owner_user_id == sub.user_id).first()
        amount = _subscription_amount_cents(sub)
        interval = sub.interval.value if sub.interval else "month"
        paid_at = sub.current_period_end - timedelta(days=365 if interval == "year" else 30) if sub.current_period_end else datetime.now(timezone.utc)
        if paid_at.tzinfo is None:
            paid_at = paid_at.replace(tzinfo=timezone.utc)
        number = f"SWA-{sub.user_id:04d}-{int(paid_at.timestamp())}"
        row = BillingInvoice(
            stripe_invoice_id=f"local_inv_{sub.user_id}_{int(paid_at.timestamp())}",
            user_id=sub.user_id,
            rehab_center_id=center.id if center else None,
            number=number,
            status="paid",
            amount_due=amount,
            amount_paid=amount,
            currency="usd",
            interval=interval,
            period_start=paid_at,
            period_end=sub.current_period_end,
            paid_at=paid_at,
            source="subscription",
            product_label="Base listing subscription",
            description=f"Listing subscription ({interval})",
        )
        db.add(row)
        created += 1
    if created:
        db.commit()
    return created


def _build_invoice_pdf_bytes(db: Session, row: BillingInvoice) -> bytes:
    user = db.query(User).filter(User.id == row.user_id).first() if row.user_id else None
    center = db.query(RehabCenter).filter(RehabCenter.id == row.rehab_center_id).first() if row.rehab_center_id else None
    amount = _format_money(row.amount_paid if row.status == "paid" else row.amount_due, row.currency)
    issued = row.paid_at or row.created_at
    issued_on = issued.strftime("%b %d, %Y") if issued else "-"
    period_label = ""
    if row.period_start or row.period_end:
        start = row.period_start.strftime("%b %d, %Y") if row.period_start else "-"
        end = row.period_end.strftime("%b %d, %Y") if row.period_end else "-"
        period_label = f"{start} - {end}"
    bill_name = ""
    if user:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        bill_name = (profile.display_name if profile and profile.display_name else "") or ""
    return build_invoice_pdf(
        InvoicePdfData(
            number=row.number or row.stripe_invoice_id or str(row.id),
            status=row.status or "open",
            issued_on=issued_on,
            bill_to_name=bill_name or (user.email if user else "-"),
            bill_to_email=user.email if user else "-",
            center_name=center.name if center else "",
            product=row.product_label or "Listing subscription",
            interval=row.interval or "-",
            amount_label=amount,
            period_label=period_label,
            description=row.description or "",
            support_email=settings.email_from or "noreply@strugglingwithaddiction.com",
            site_url=settings.public_site_url or "https://strugglingwithaddiction.com",
        )
    )


def create_local_invoice_for_subscription(
    db: Session,
    *,
    user_id: int,
    interval: str | None = None,
    amount_cents: int | None = None,
    rehab_center_id: int | None = None,
) -> BillingInvoice:
    """Create a paid local invoice after successful subscription payment."""
    sub = _user_subscription(db, user_id)
    if amount_cents is None:
        amount_cents = _subscription_amount_cents(sub) if sub else 999
    if not interval and sub and sub.interval:
        interval = sub.interval.value
    interval = interval or "month"
    if not rehab_center_id:
        center = db.query(RehabCenter).filter(RehabCenter.owner_user_id == user_id).first()
        rehab_center_id = center.id if center else None
    now = datetime.now(timezone.utc)
    number = f"SWA-{user_id:04d}-{int(now.timestamp())}"
    row = BillingInvoice(
        stripe_invoice_id=f"local_inv_{user_id}_{int(now.timestamp())}",
        user_id=user_id,
        rehab_center_id=rehab_center_id,
        number=number,
        status="paid",
        amount_due=amount_cents,
        amount_paid=amount_cents,
        currency="usd",
        interval=interval,
        period_start=now,
        period_end=sub.current_period_end if sub else None,
        paid_at=now,
        source="subscription",
        product_label="Base listing subscription",
        description=f"Listing subscription ({interval})",
    )
    db.add(row)
    return row


@router.get("/admin/invoices")
def admin_list_invoices(
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
    status: str | None = None,
    source: str | None = None,
    paid_filter: str = Query("all", alias="filter"),
    limit: int = Query(200, ge=1, le=500),
):
    # Ensure demo/active subscribers have viewable invoices even without Stripe webhooks.
    _ensure_local_invoices(db)

    # When Stripe is connected, pull latest invoices into the mirror.
    st = _stripe(db)
    if st:
        subs = db.query(Subscription).filter(Subscription.stripe_customer_id.isnot(None)).all()
        for sub in subs:
            try:
                remote = st.Invoice.list(customer=sub.stripe_customer_id, limit=20)
                for inv in remote.data:
                    upsert_billing_invoice(
                        db,
                        inv,
                        user_id=sub.user_id,
                        source="subscription",
                        product_label="Listing subscription",
                        interval=sub.interval.value if sub.interval else None,
                    )
            except Exception:
                continue
        db.commit()

    paid_count = db.query(BillingInvoice).filter(BillingInvoice.status == "paid").count()
    unpaid_count = db.query(BillingInvoice).filter(BillingInvoice.status.in_(tuple(UNPAID_INVOICE_STATUSES))).count()
    all_count = db.query(BillingInvoice).count()

    q = db.query(BillingInvoice).order_by(BillingInvoice.paid_at.desc().nullslast(), BillingInvoice.id.desc())
    paid_filter = (paid_filter or "all").strip().lower()
    if paid_filter in ("paid", "yes"):
        q = q.filter(BillingInvoice.status == "paid")
    elif paid_filter in ("unpaid", "not_paid", "open"):
        q = q.filter(BillingInvoice.status.in_(tuple(UNPAID_INVOICE_STATUSES)))
    if status:
        q = q.filter(BillingInvoice.status == status)
    if source:
        q = q.filter(BillingInvoice.source == source)
    rows = q.limit(limit).all()
    out = []
    for r in rows:
        email = None
        center_name = None
        if r.user_id:
            u = db.query(User).filter(User.id == r.user_id).first()
            email = u.email if u else None
        if r.rehab_center_id:
            c = db.query(RehabCenter).filter(RehabCenter.id == r.rehab_center_id).first()
            center_name = c.name if c else None
        item = _invoice_out(r, email=email, center_name=center_name)
        if item.payable and not item.pay_url and st and r.stripe_invoice_id:
            url = ensure_hosted_invoice_url(st, r.stripe_invoice_id)
            if url:
                r.hosted_invoice_url = url
                item.pay_url = url
                item.hosted_invoice_url = url
        out.append(item)
    db.commit()
    return {
        "invoices": out,
        "counts": {"all": all_count, "paid": paid_count, "unpaid": unpaid_count},
        "filter": paid_filter,
    }


@router.get("/admin/invoices/{invoice_id}")
def admin_get_invoice(invoice_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    row = db.query(BillingInvoice).filter(BillingInvoice.id == invoice_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")
    email = None
    center_name = None
    if row.user_id:
        u = db.query(User).filter(User.id == row.user_id).first()
        email = u.email if u else None
    if row.rehab_center_id:
        c = db.query(RehabCenter).filter(RehabCenter.id == row.rehab_center_id).first()
        center_name = c.name if c else None
    return _invoice_out(row, email=email, center_name=center_name)


@router.post("/admin/invoices/{invoice_id}/pay-link")
def admin_invoice_pay_link(invoice_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    row = db.query(BillingInvoice).filter(BillingInvoice.id == invoice_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not invoice_is_payable(row.status) and not invoice_is_unpaid(row.status):
        raise HTTPException(status_code=400, detail="This invoice is not payable")
    st = _stripe(db)
    sub = db.query(Subscription).filter(Subscription.user_id == row.user_id).first() if row.user_id else None
    user = db.query(User).filter(User.id == row.user_id).first() if row.user_id else None
    pay_url = _pay_url_for_invoice(
        st,
        db,
        row,
        stripe_invoice_id=row.stripe_invoice_id,
        customer_id=sub.stripe_customer_id if sub else None,
        user_email=user.email if user else None,
    )
    return {"pay_url": pay_url, "kind": "stripe"}


@router.get("/admin/invoices/{invoice_id}/pdf")
def admin_invoice_pdf(invoice_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)], download: int = Query(1)):
    row = db.query(BillingInvoice).filter(BillingInvoice.id == invoice_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Prefer official Stripe PDF when available
    if row.invoice_pdf and not str(row.stripe_invoice_id).startswith("local_"):
        if download:
            return RedirectResponse(url=row.invoice_pdf)
        return {"url": row.invoice_pdf, "hosted_invoice_url": row.hosted_invoice_url}

    st = _stripe(db)
    if st and row.stripe_invoice_id and not str(row.stripe_invoice_id).startswith("local_"):
        try:
            inv = st.Invoice.retrieve(row.stripe_invoice_id)
            if inv.invoice_pdf:
                row.invoice_pdf = inv.invoice_pdf
                row.hosted_invoice_url = inv.hosted_invoice_url or row.hosted_invoice_url
                db.commit()
                if download:
                    return RedirectResponse(url=inv.invoice_pdf)
                return {"url": inv.invoice_pdf, "hosted_invoice_url": inv.hosted_invoice_url}
        except Exception:
            pass

    # Local / generated PDF
    pdf = _build_invoice_pdf_bytes(db, row)
    filename = f"{row.number or row.stripe_invoice_id or invoice_id}.pdf".replace(" ", "-")
    disposition = "attachment" if download else "inline"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
    )


@router.get("/admin/reports/sales")
def admin_sales_report(
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
    days: int = Query(30, ge=1, le=365),
    format: str = Query("json"),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    invoices = (
        db.query(BillingInvoice)
        .filter(BillingInvoice.status == "paid", BillingInvoice.paid_at >= since)
        .order_by(BillingInvoice.paid_at.desc())
        .all()
    )
    upgrades = (
        db.query(UpsellOrder)
        .filter(
            UpsellOrder.status.in_((UpsellOrderStatus.paid, UpsellOrderStatus.fulfilled)),
            UpsellOrder.created_at >= since,
        )
        .order_by(UpsellOrder.created_at.desc())
        .all()
    )

    sub_total = sum(i.amount_paid for i in invoices if i.source == "subscription")
    upsell_from_inv = sum(i.amount_paid for i in invoices if i.source == "upsell")
    upsell_orders = sum(o.amount_cents or 0 for o in upgrades)
    by_interval = {"month": 0, "year": 0, "other": 0}
    for i in invoices:
        key = i.interval if i.interval in ("month", "year") else "other"
        by_interval[key] += i.amount_paid

    report = {
        "period_days": days,
        "subscription_revenue_cents": sub_total,
        "subscription_revenue_label": _format_money(sub_total),
        "upgrade_revenue_cents": upsell_from_inv + upsell_orders,
        "upgrade_revenue_label": _format_money(upsell_from_inv + upsell_orders),
        "total_revenue_cents": sub_total + upsell_from_inv + upsell_orders,
        "total_revenue_label": _format_money(sub_total + upsell_from_inv + upsell_orders),
        "by_interval": {k: {"cents": v, "label": _format_money(v)} for k, v in by_interval.items()},
        "invoice_count": len(invoices),
        "upgrade_order_count": len(upgrades),
        "invoices": [
            {
                "id": i.id,
                "number": i.number,
                "paid_at": i.paid_at.isoformat() if i.paid_at else None,
                "amount_paid": i.amount_paid,
                "amount_label": _format_money(i.amount_paid, i.currency),
                "source": i.source,
                "interval": i.interval,
                "product_label": i.product_label,
                "user_id": i.user_id,
            }
            for i in invoices
        ],
        "upgrades": [
            {
                "id": o.id,
                "product_type": o.product_type.value if o.product_type else None,
                "amount_cents": o.amount_cents,
                "amount_label": _format_money(o.amount_cents),
                "status": o.status.value if o.status else None,
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "rehab_center_id": o.rehab_center_id,
            }
            for o in upgrades
        ],
    }

    if format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["type", "id", "date", "amount_cents", "label", "interval_or_product", "source"])
        for i in invoices:
            writer.writerow([
                "invoice",
                i.id,
                i.paid_at.isoformat() if i.paid_at else "",
                i.amount_paid,
                i.product_label or "",
                i.interval or "",
                i.source,
            ])
        for o in upgrades:
            writer.writerow([
                "upgrade",
                o.id,
                o.created_at.isoformat() if o.created_at else "",
                o.amount_cents or 0,
                o.product_type.value if o.product_type else "",
                "",
                "upsell",
            ])
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="swa-sales-{days}d.csv"'},
        )
    return report


@router.get("/admin/stripe-status")
def admin_stripe_status(_: AdminUser, db: Annotated[Session, Depends(get_db)], request: Request):
    base = str(request.base_url).rstrip("/")
    return stripe_status_payload(db, api_base=base)


@router.get("/admin/stripe-settings")
def admin_get_stripe_settings(_: AdminUser, db: Annotated[Session, Depends(get_db)], request: Request):
    return stripe_status_payload(db, api_base=str(request.base_url).rstrip("/"))


@router.patch("/admin/stripe-settings")
def admin_update_stripe_settings(body: StripeSettingsUpdate, _: AdminUser, db: Annotated[Session, Depends(get_db)], request: Request):
    row = get_or_create_stripe_settings(db)
    data = body.model_dump(exclude_unset=True)
    if data.pop("clear_secret_key", False):
        row.secret_key = None
    if data.pop("clear_webhook_secret", False):
        row.webhook_secret = None
    if data.pop("clear_test_secret_key", False):
        row.test_secret_key = None
    if data.pop("clear_test_webhook_secret", False):
        row.test_webhook_secret = None
    if "mode" in data and data["mode"] is not None:
        row.mode = normalize_stripe_mode(str(data.pop("mode")))
    else:
        data.pop("mode", None)
    secret_fields = {
        "secret_key",
        "webhook_secret",
        "test_secret_key",
        "test_webhook_secret",
    }
    for key in (
        "enabled",
        "secret_key",
        "webhook_secret",
        "publishable_key",
        "price_monthly",
        "price_yearly",
        "price_verified_badge",
        "price_featured_placement",
        "test_secret_key",
        "test_webhook_secret",
        "test_publishable_key",
        "test_price_monthly",
        "test_price_yearly",
        "test_price_verified_badge",
        "test_price_featured_placement",
    ):
        if key in data and data[key] is not None:
            val = data[key]
            if isinstance(val, str) and key in secret_fields and "…" in val:
                continue  # ignore masked echoes
            setattr(row, key, val if not isinstance(val, str) else val.strip() or None)
    db.commit()
    sync_subscription_plan_prices(db)
    return stripe_status_payload(db, api_base=str(request.base_url).rstrip("/"))


def _provision_stripe_catalog(db: Session, request: Request, *, mode: str):
    active = normalize_stripe_mode(mode)
    st = init_stripe_sdk(db, mode=active)
    if not st:
        kind = "test secret key (sk_test_…)" if active == "test" else "live secret key (sk_live_ / rk_live_…)"
        raise HTTPException(status_code=400, detail=f"Add a Stripe {kind} first, then create products.")
    try:
        created = provision_stripe_catalog(st)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Unable to create Stripe products: {exc}") from exc
    apply_catalog_prices(db, created, mode=active)
    payload = stripe_status_payload(db, api_base=str(request.base_url).rstrip("/"))
    payload["provisioned"] = created
    return payload


@router.post("/admin/stripe-verify")
def admin_verify_stripe(_: AdminUser, db: Annotated[Session, Depends(get_db)], request: Request):
    payload = stripe_status_payload(db, api_base=str(request.base_url).rstrip("/"))
    account = payload.get("account") or probe_stripe_account(db)
    if not account.get("ok"):
        raise HTTPException(status_code=502, detail=account.get("error") or "Stripe account check failed")
    return payload


@router.post("/admin/stripe-provision-live")
def admin_provision_live_catalog(_: AdminUser, db: Annotated[Session, Depends(get_db)], request: Request):
    """Find or create live products/prices on the connected Stripe account and save the IDs."""
    return _provision_stripe_catalog(db, request, mode="live")


@router.post("/admin/stripe-provision-sandbox")
def admin_provision_sandbox_catalog(_: AdminUser, db: Annotated[Session, Depends(get_db)], request: Request):
    """Create sandbox products/prices on the Stripe test account and save the IDs."""
    return _provision_stripe_catalog(db, request, mode="test")


@router.get("/admin/plans", response_model=list[SubscriptionPlanOut])
def admin_plans(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    return db.query(SubscriptionPlan).order_by(SubscriptionPlan.sort_order).all()


@router.patch("/admin/plans/{plan_id}", response_model=SubscriptionPlanOut)
def update_plan(plan_id: int, body: SubscriptionPlanUpdate, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(plan, k, v)
    db.commit()
    db.refresh(plan)
    return plan
