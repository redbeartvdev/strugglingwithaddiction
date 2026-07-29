from datetime import datetime, timezone
from typing import Annotated, Any

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.deps import AdminUser, ClientUser, CurrentUser
from app.core.security import hash_password
from app.database import get_db
from app.models.billing import BillingInterval, RegistrationIntent, Subscription, SubscriptionPlan
from app.models.profile import UserProfile
from app.models.rehab import RehabCenter
from app.models.user import User, UserRole
from app.schemas.billing import (
    CheckoutRequest,
    RegisterBillingRequest,
    SubscriberAdmin,
    SubscriptionOut,
    SubscriptionPlanOut,
    SubscriptionPlanUpdate,
)
from app.services.simple_pdf import build_simple_pdf

router = APIRouter(prefix="/api/billing", tags=["billing"])
settings = get_settings()


def _stripe():
    if not settings.stripe_secret_key:
        return None
    stripe.api_key = settings.stripe_secret_key
    return stripe


def _user_subscription(db: Session, user_id: int) -> Subscription | None:
    return db.query(Subscription).filter(Subscription.user_id == user_id).first()


def _require_stripe_customer(user: User, db: Session) -> tuple[Any, Subscription]:
    st = _stripe()
    if not st:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    sub_row = _user_subscription(db, user.id)
    if not sub_row or not sub_row.stripe_customer_id:
        raise HTTPException(status_code=404, detail="No billing account yet")
    return st, sub_row


def _format_money(amount_cents: int | None, currency: str | None = "usd") -> str:
    cents = int(amount_cents or 0)
    cur = (currency or "usd").upper()
    return f"{cur} {cents / 100:.2f}"


def _invoice_row(inv) -> dict:
    return {
        "id": inv.id,
        "number": inv.number or inv.id,
        "status": inv.status,
        "amount_due": inv.amount_due,
        "amount_paid": inv.amount_paid,
        "currency": inv.currency,
        "amount_label": _format_money(inv.amount_paid if inv.status == "paid" else inv.amount_due, inv.currency),
        "created": datetime.fromtimestamp(inv.created, tz=timezone.utc).isoformat() if inv.created else None,
        "period_start": datetime.fromtimestamp(inv.period_start, tz=timezone.utc).isoformat() if getattr(inv, "period_start", None) else None,
        "period_end": datetime.fromtimestamp(inv.period_end, tz=timezone.utc).isoformat() if getattr(inv, "period_end", None) else None,
        "hosted_invoice_url": inv.hosted_invoice_url,
        "invoice_pdf": inv.invoice_pdf,
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
    # Checkout Sessions report status="complete", which is not a subscription status.
    status_value = payload.get("status")
    sub_row.status = status_value if status_value in ("active", "trialing", "past_due", "unpaid", "canceled", "paused") else (
        "active" if fallback_active else sub_row.status
    )
    sub_row.current_period_end = _stripe_timestamp(payload.get("current_period_end")) or sub_row.current_period_end


def _subscription_out(db: Session, user: User) -> SubscriptionOut:
    sub = _user_subscription(db, user.id)
    if not sub:
        return SubscriptionOut(status="inactive", interval=None, current_period_end=None, plan_name=None)
    plan_name = sub.plan.name if sub.plan else None
    return SubscriptionOut(
        status=sub.status,
        interval=sub.interval.value if sub.interval else None,
        current_period_end=sub.current_period_end,
        plan_name=plan_name,
    )


@router.get("/plans", response_model=list[SubscriptionPlanOut])
def list_plans(db: Annotated[Session, Depends(get_db)]):
    return db.query(SubscriptionPlan).filter(SubscriptionPlan.is_active.is_(True)).order_by(SubscriptionPlan.sort_order).all()


@router.post("/register")
def register_and_checkout(body: RegisterBillingRequest, db: Annotated[Session, Depends(get_db)]):
    st = _stripe()
    if not st:
        raise HTTPException(status_code=503, detail="Stripe not configured")
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
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.is_active.is_(True)).first()
    price_id = settings.stripe_price_yearly if interval == BillingInterval.year else settings.stripe_price_monthly
    if plan:
        price_id = plan.stripe_price_id_yearly if interval == BillingInterval.year else plan.stripe_price_id_monthly or price_id
    if not price_id:
        raise HTTPException(status_code=503, detail="Stripe price not configured")
    session = st.checkout.Session.create(
        customer=customer.id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.admin_site_url}/client/billing?success=1",
        cancel_url=f"{settings.admin_site_url}/register?canceled=1",
        metadata={"user_id": str(user.id)},
    )
    sub_row.plan_id = plan.id if plan else None
    db.commit()
    return {"checkout_url": session.url, "user_id": user.id}


@router.post("/checkout")
def create_checkout(body: CheckoutRequest, user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    st = _stripe()
    if not st:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    sub_row = _user_subscription(db, user.id)
    if not sub_row or not sub_row.stripe_customer_id:
        customer = st.Customer.create(email=user.email)
        sub_row = Subscription(user_id=user.id, stripe_customer_id=customer.id, status="pending")
        db.add(sub_row)
        db.commit()
    interval = BillingInterval.year if body.interval == "year" else BillingInterval.month
    price_id = settings.stripe_price_yearly if interval == BillingInterval.year else settings.stripe_price_monthly
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.is_active.is_(True)).first()
    if plan:
        price_id = plan.stripe_price_id_yearly if interval == BillingInterval.year else plan.stripe_price_id_monthly or price_id
    session = st.checkout.Session.create(
        customer=sub_row.stripe_customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.admin_site_url}/client/billing?success=1",
        cancel_url=f"{settings.admin_site_url}/client/billing?canceled=1",
        metadata={"user_id": str(user.id)},
    )
    return {"checkout_url": session.url}


@router.get("/subscription", response_model=SubscriptionOut)
def get_subscription(user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    return _subscription_out(db, user)


@router.post("/portal")
def billing_portal(user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    st = _stripe()
    if not st:
        raise HTTPException(status_code=503, detail="Stripe not configured")
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
    """List Stripe invoices for the signed-in provider."""
    st = _stripe()
    sub_row = _user_subscription(db, user.id)
    if not st or not sub_row or not sub_row.stripe_customer_id:
        return {"invoices": [], "stripe_configured": bool(st), "has_customer": bool(sub_row and sub_row.stripe_customer_id)}
    try:
        invoices = st.Invoice.list(customer=sub_row.stripe_customer_id, limit=50)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Unable to load invoices: {exc}") from exc
    return {
        "invoices": [_invoice_row(inv) for inv in invoices.data],
        "stripe_configured": True,
        "has_customer": True,
    }


@router.get("/payments")
def list_payments(user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    """List Stripe charges / payment history for the signed-in provider."""
    st = _stripe()
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


@router.get("/invoices/{invoice_id}/pdf")
def download_invoice_pdf(invoice_id: str, user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    """Redirect to the official Stripe invoice PDF for this customer."""
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
    """Download a PDF summary of invoices and payment history."""
    st = _stripe()
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


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Annotated[Session, Depends(get_db)]):
    st = _stripe()
    if not st or not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook not configured")
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")

    from app.api.claim_journey import downgrade_center_after_cancel, grant_claim_on_payment
    from app.models.upsell import UpsellOrder, UpsellOrderStatus, UpsellProductType
    from app.services.email import send_email

    etype = event["type"]
    data = event["data"]["object"]

    if etype in ("checkout.session.completed", "customer.subscription.updated", "customer.subscription.created"):
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
            if etype == "checkout.session.completed":
                subscription_payload = None
                subscription_id = data.get("subscription")
                if subscription_id:
                    try:
                        subscription_payload = st.Subscription.retrieve(subscription_id)
                    except Exception:
                        # Payment succeeded; Stripe will also deliver a subscription event.
                        subscription_payload = None
                _sync_subscription_from_stripe(sub_row, subscription_payload, fallback_active=True)
            else:
                _sync_subscription_from_stripe(sub_row, data)

            # Stripe keeps this subscription active through its paid period.
            # The deletion webhook below performs the actual downgrade.
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

            # Stripe has exhausted Smart Retries; follow the same downgrade path
            # as a completed cancellation.
            if etype == "customer.subscription.updated" and sub_row.status == "unpaid":
                center = db.query(RehabCenter).filter(RehabCenter.owner_user_id == user_id).first()
                if center and center.claimed:
                    downgrade_center_after_cancel(db, user_id, send_winback=True)

            # Upsell one-time / placement checkout
            if meta.get("upsell_order_id"):
                order = db.query(UpsellOrder).filter(UpsellOrder.id == int(meta["upsell_order_id"])).first()
                if order:
                    order.status = UpsellOrderStatus.paid
                    center = db.query(RehabCenter).filter(RehabCenter.id == order.rehab_center_id).first()
                    if center and str(order.product_type) == UpsellProductType.verified_badge.value:
                        center.verified_badge = True
                    if center and str(order.product_type) == UpsellProductType.featured_placement.value:
                        from datetime import timedelta, timezone as tz
                        from datetime import datetime as dt
                        center.featured_until = dt.now(tz.utc) + timedelta(days=30)
                    if user:
                        product_key = (
                            order.product_type.value
                            if hasattr(order.product_type, "value")
                            else str(order.product_type)
                        )
                        product_label = product_key.replace("_", " ").title()
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
                                "login_url": f"{settings.admin_site_url}/login",
                                "billing_url": f"{settings.admin_site_url}/client/billing",
                            },
                            user_id=user.id,
                            rehab_center_id=order.rehab_center_id,
                        )
            elif etype == "checkout.session.completed":
                grant_claim_on_payment(
                    db,
                    user_id=user_id,
                    claim_ticket=meta.get("claim_ticket"),
                    rehab_center_id=int(meta["rehab_center_id"]) if meta.get("rehab_center_id") else None,
                )
                if user:
                    send_email(
                        db,
                        to_email=user.email,
                        template_key="payment_receipt",
                        context={"name": user.email, "center_name": "your listing", "amount": "$9.99", "receipt_url": f"{settings.admin_site_url}/client/billing", "billing_url": f"{settings.admin_site_url}/client/billing"},
                        user_id=user.id,
                    )

    elif etype == "invoice.paid":
        customer_id = data.get("customer")
        billing_reason = data.get("billing_reason") or ""
        sub_row = db.query(Subscription).filter(Subscription.stripe_customer_id == customer_id).first() if customer_id else None
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
                    },
                    user_id=user.id,
                    rehab_center_id=center.id if center else None,
                )

    elif etype == "invoice.payment_failed":
        customer_id = data.get("customer")
        sub_row = db.query(Subscription).filter(Subscription.stripe_customer_id == customer_id).first() if customer_id else None
        if sub_row:
            user = db.query(User).filter(User.id == sub_row.user_id).first()
            center = db.query(RehabCenter).filter(RehabCenter.owner_user_id == sub_row.user_id).first()
            if user:
                send_email(
                    db,
                    to_email=user.email,
                    template_key="dunning",
                    context={
                        "name": user.email,
                        "center_name": center.name if center else "your listing",
                        "billing_url": f"{settings.admin_site_url}/client/billing",
                    },
                    user_id=user.id,
                    rehab_center_id=center.id if center else None,
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
            # Grace: Stripe keeps access until period end; on deleted, downgrade now
            if etype == "customer.subscription.deleted":
                downgrade_center_after_cancel(db, sub_row.user_id, send_winback=True)

    db.commit()
    return {"received": True}


@router.get("/admin/subscribers", response_model=list[SubscriberAdmin])
def admin_subscribers(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    subs = db.query(Subscription).all()
    result = []
    for s in subs:
        user = db.query(User).filter(User.id == s.user_id).first()
        profile = db.query(UserProfile).filter(UserProfile.user_id == s.user_id).first()
        result.append(
            SubscriberAdmin(
                user_id=s.user_id,
                email=user.email if user else "",
                display_name=profile.display_name if profile else "",
                status=s.status,
                interval=s.interval.value if s.interval else None,
                current_period_end=s.current_period_end,
            )
        )
    return result


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
