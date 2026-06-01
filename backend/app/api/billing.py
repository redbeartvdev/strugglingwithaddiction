from datetime import datetime, timezone
from typing import Annotated

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
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

router = APIRouter(prefix="/api/billing", tags=["billing"])
settings = get_settings()


def _stripe():
    if not settings.stripe_secret_key:
        return None
    stripe.api_key = settings.stripe_secret_key
    return stripe


def _user_subscription(db: Session, user_id: int) -> Subscription | None:
    return db.query(Subscription).filter(Subscription.user_id == user_id).first()


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
    if event["type"] in ("checkout.session.completed", "customer.subscription.updated", "customer.subscription.created"):
        data = event["data"]["object"]
        user_id = None
        if "metadata" in data and data["metadata"].get("user_id"):
            user_id = int(data["metadata"]["user_id"])
        customer_id = data.get("customer")
        sub_row = None
        if user_id:
            sub_row = _user_subscription(db, user_id)
        elif customer_id:
            sub_row = db.query(Subscription).filter(Subscription.stripe_customer_id == customer_id).first()
        if sub_row:
            user = db.query(User).filter(User.id == sub_row.user_id).first()
            if user:
                user.is_active = True
            sub_row.status = "active"
            if event["type"] != "checkout.session.completed":
                sub_row.stripe_subscription_id = data.get("id") or sub_row.stripe_subscription_id
                sub_row.status = data.get("status", sub_row.status)
            center = db.query(RehabCenter).filter(RehabCenter.owner_user_id == sub_row.user_id).first()
            if center:
                center.contact_visible = True
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
