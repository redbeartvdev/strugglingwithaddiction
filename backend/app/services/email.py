"""Transactional email sender for claim-to-subscription lifecycle."""
from __future__ import annotations

import html
import json
import logging
import re
import smtplib
from datetime import datetime
from email.message import EmailMessage
from string import Formatter
from typing import Any
from urllib import error, request

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.email_log import EmailLog
from app.models.email_template import EmailTemplateOverride
from app.models.platform_settings import PlatformEmailSettings
from app.models.profile import UserProfile

logger = logging.getLogger("swa")
settings = get_settings()

GMAIL_SMTP_HOST = "smtp.gmail.com"
GMAIL_SMTP_PORT = 587

DEFAULT_SOCIAL = {
    "facebook": "https://www.facebook.com/strugglingwithaddictionblog/",
    "twitter": "https://twitter.com/addiction_with",
    "youtube": "https://www.youtube.com/channel/UCUcy2jFODQvkvketJ5bZJbA",
    "instagram": "",
    "linkedin": "",
}

# Built-in transactional catalog. Admins can override subject/body in the dashboard.
TEMPLATE_META: dict[str, dict[str, str]] = {
    "account_created": {
        "label": "Account created",
        "description": "Welcome a new client account and point them to next steps.",
        "category": "auth",
    },
    "email_confirmation": {
        "label": "Email confirmation",
        "description": "Confirm a new or changed account email address.",
        "category": "auth",
    },
    "password_reset": {
        "label": "Password reset",
        "description": "Secure link to set a new account password.",
        "category": "auth",
    },
    "password_changed": {
        "label": "Password changed",
        "description": "Security notice after a successful password change.",
        "category": "auth",
    },
    "outreach_invite": {
        "label": "Outreach invite",
        "description": "Invite an unclaimed center to claim their directory listing.",
        "category": "claim",
    },
    "admin_new_claim": {
        "label": "Admin — new claim started",
        "description": "Internal alert when someone starts a listing claim.",
        "category": "claim",
    },
    "admin_new_center_submission": {
        "label": "Admin — new center submission",
        "description": "Internal alert when someone submits a missing facility.",
        "category": "claim",
    },
    "center_submission_received": {
        "label": "Center submission received",
        "description": "Confirm to the submitter that we received their facility.",
        "category": "claim",
    },
    "center_submission_approved": {
        "label": "Center submission approved",
        "description": "Notify the submitter that their facility was accepted.",
        "category": "claim",
    },
    "center_submission_rejected": {
        "label": "Center submission rejected",
        "description": "Notify the submitter that their facility was not accepted.",
        "category": "claim",
    },
    "verification": {
        "label": "Claim verification",
        "description": "Ask a claimant to upload rehab certification.",
        "category": "claim",
    },
    "claim_submitted": {
        "label": "Claim submitted",
        "description": "Confirm to the claimant that their claim and certification were received.",
        "category": "claim",
    },
    "claim_under_review_admin": {
        "label": "Admin — certification under review",
        "description": "Internal alert when certification is uploaded for review.",
        "category": "claim",
    },
    "claim_certified": {
        "label": "Claim certified",
        "description": "Tell the claimant they are verified and can subscribe.",
        "category": "claim",
    },
    "claim_rejected": {
        "label": "Claim rejected",
        "description": "Notify the claimant that their claim was not approved.",
        "category": "claim",
    },
    "claim_abandon_reminder": {
        "label": "Claim abandon reminder",
        "description": "Day 1 or day 2 nudge with a link to continue an unfinished claim.",
        "category": "claim",
    },
    "submit_abandon_reminder": {
        "label": "Submit-center abandon reminder",
        "description": "Day 1 or day 2 nudge with a link to continue an unfinished center submission.",
        "category": "claim",
    },
    "phone_callback_code": {
        "label": "Phone callback code (email backup)",
        "description": "Email backup of the facility phone ownership code.",
        "category": "claim",
    },
    "welcome": {
        "label": "Welcome / listing claimed",
        "description": "Sent after a listing is claimed and payment succeeds.",
        "category": "billing",
    },
    "payment_receipt": {
        "label": "Payment receipt",
        "description": "Receipt after a successful Stripe subscription payment.",
        "category": "billing",
    },
    "subscription_renewed": {
        "label": "Subscription renewed",
        "description": "Confirm a successful recurring renewal charge.",
        "category": "billing",
    },
    "renewal_reminder": {
        "label": "Renewal reminder",
        "description": "Remind a subscriber that their card will be charged soon.",
        "category": "billing",
    },
    "dunning": {
        "label": "Payment failed (dunning)",
        "description": "Ask the subscriber to update their card after a failed renewal.",
        "category": "billing",
    },
    "cancellation": {
        "label": "Cancellation confirmed",
        "description": "Confirm subscription cancellation and access end date.",
        "category": "billing",
    },
    "subscription_expired": {
        "label": "Subscription expired / access ended",
        "description": "Confirm that paid listing access has ended.",
        "category": "billing",
    },
    "win_back": {
        "label": "Win-back",
        "description": "Invite a downgraded center to resubscribe.",
        "category": "billing",
    },
    "new_lead_alert": {
        "label": "New lead alert",
        "description": "Notify a provider when a visitor submits an inquiry.",
        "category": "leads",
    },
    "lead_reply": {
        "label": "Lead reply",
        "description": "Forward a provider reply to the visitor who inquired.",
        "category": "leads",
    },
    "profile_published": {
        "label": "Profile published",
        "description": "Confirm that listing updates are live on the public site.",
        "category": "leads",
    },
    "upsell_receipt": {
        "label": "Upsell receipt",
        "description": "Confirm purchase of a listing upsell product.",
        "category": "upsells",
    },
    "upsell_fulfilled": {
        "label": "Upsell fulfilled",
        "description": "Notify the client that a human-fulfilled upsell is complete.",
        "category": "upsells",
    },
    "upsell_human_lead": {
        "label": "Upsell human lead (internal)",
        "description": "Internal alert when a human-closed upsell interest is captured.",
        "category": "upsells",
    },
    "product_updates": {
        "label": "Product updates",
        "description": "Occasional directory product and feature updates.",
        "category": "marketing",
    },
}

DEFAULT_TEMPLATES: dict[str, tuple[str, str]] = {
    "account_created": (
        "Your Struggling With Addiction account is ready",
        "Hi {name},\n\nYour account ({email}) is set up{claim_for}.\n\n"
        "Sign in here: {login_url}\n\n"
        "If you started a listing claim, continue verification from your claim status page.\n",
    ),
    "email_confirmation": (
        "Confirm your email address",
        "Hi {name},\n\nConfirm your email address to secure your account:\n{confirmation_url}\n\n"
        "This link expires in one hour.\n",
    ),
    "password_reset": (
        "Reset your password",
        "Hi {name},\n\nUse this secure link to set a new password:\n{reset_url}\n\n"
        "If you did not request this, ignore this email.\n",
    ),
    "password_changed": (
        "Your password was changed",
        "Hi {name},\n\nYour Struggling With Addiction password was just updated.\n\n"
        "If this was you, no further action is needed.\n"
        "If you did not change your password, reset it immediately: {reset_url}\n"
        "Support: {support_email}\n",
    ),
    "outreach_invite": (
        "Your center is listed on Struggling With Addiction — claim it today",
        "Hi,\n\nYour facility appears in our directory at {listing_url}.\n\n"
        "Claim your listing to manage your profile and receive visitor inquiries:\n{claim_url}\n\n"
        "— {site_name}\n{postal_address}\nUnsubscribe: {unsubscribe_url}\n",
    ),
    "admin_new_claim": (
        "New claim started — {center_name}",
        "A new listing claim was started.\n\n"
        "Center: {center_name}\nTicket: {ticket}\nClaimant: {name}\nEmail: {email}\nPhone: {lead_phone}\n\n"
        "Review claims: {admin_claims_url}\nClaim status: {claim_url}\n",
    ),
    "admin_new_center_submission": (
        "New center submission — {center_name}",
        "A facility asked to be added to the directory.\n\n"
        "Submission #{submission_id}\n"
        "Center: {center_name}\n"
        "Contact: {name}\nEmail: {email}\nPhone: {lead_phone}\n"
        "Address: {location}\n"
        "Services: {services}\n"
        "Insurance: {insurances}\n\n"
        "Description:\n{description}\n\n"
        "Open Submission Center: {admin_submissions_url}\n",
    ),
    "center_submission_received": (
        "We received your facility submission",
        "Hi {name},\n\nThanks for submitting {center_name}. Our team will review the details and follow up if we need anything else.\n\n"
        "— {site_name}\n",
    ),
    "center_submission_approved": (
        "Your facility submission was accepted — {center_name}",
        "Hi {name},\n\nGood news — we accepted your submission for {center_name}.\n\n"
        "{admin_notes}\n\n"
        "Provider login: {login_url}\n",
    ),
    "center_submission_rejected": (
        "Update on your facility submission — {center_name}",
        "Hi {name},\n\nWe were unable to accept the submission for {center_name} at this time.\n\n"
        "{admin_notes}\n\n"
        "Questions? Contact {support_email}\n",
    ),
    "verification": (
        "Subscribe, then upload certification for {center_name}",
        "Hi {name},\n\nWe received your claim for {center_name} (ticket {ticket}).\n\n"
        "1. Choose a monthly or yearly plan at: {claim_url}\n"
        "2. After payment, upload your state license or accreditation certificate.\n\n"
        "Your listing unlocks after admin verification.\n",
    ),
    "claim_submitted": (
        "Your claim for {center_name} is pending admin verification",
        "Hi {name},\n\nWe received your proof for {center_name} (ticket {ticket}).\n\n"
        "Your claim is already submitted and is waiting for an admin to verify your certification. "
        "Please wait — you cannot finish claiming the listing until verification is complete.\n\n"
        "Track your claim status here:\n{claim_url}\n\n"
        "We will email you again once an admin verifies (or rejects) your claim.\n",
    ),
    "claim_under_review_admin": (
        "Certification uploaded — review claim {ticket}",
        "Certification was uploaded for review.\n\n"
        "Center: {center_name}\nTicket: {ticket}\nClaimant: {name} ({email})\n\n"
        "Open claims queue: {admin_claims_url}\n",
    ),
    "claim_certified": (
        "You're verified — subscribe to claim {center_name}",
        "Hi {name},\n\nYour certification for {center_name} is verified (ticket {ticket}).\n\n"
        "Choose a plan to finish claiming your listing:\n{billing_url}\n\n"
        "Claim status: {claim_url}\n",
    ),
    "claim_rejected": (
        "Update on your claim for {center_name}",
        "Hi {name},\n\nYour claim for {center_name} (ticket {ticket}) was not approved.\n\n"
        "{admin_notes}\n\n"
        "Questions? Contact support: {support_email}\n",
    ),
    "claim_abandon_reminder": (
        "Finish claiming {center_name}",
        "Hi {name},\n\nYou started a claim for {center_name} but did not finish "
        "(reminder day {day} of 2).\n\n"
        "Return and continue here:\n{continue_url}\n",
    ),
    "submit_abandon_reminder": (
        "Finish adding {center_name}",
        "Hi {name},\n\nYou started adding {center_name} to our directory but did not finish "
        "(reminder day {day} of 2).\n\n"
        "Return and continue here:\n{continue_url}\n",
    ),
    "phone_callback_code": (
        "Your facility phone verification code",
        "Hi {name},\n\nYour verification code for claiming {center_name} is:\n\n{otp_code}\n\n"
        "This code expires in 15 minutes. Enter it on your claim status page:\n{claim_url}\n",
    ),
    "welcome": (
        "Welcome — your listing is claimed",
        "Hi {name},\n\nPayment received. Your listing {center_name} is now claimed.\n\n"
        "One-click login: {login_url}\nGetting started checklist: complete your profile, add media, "
        "services, insurances, and levels of care.\n\n"
        "Billing portal: {billing_url}\nReceipt: {receipt_url}\nSupport: {support_email}\n",
    ),
    "payment_receipt": (
        "Receipt for your Struggling With Addiction subscription",
        "Hi {name},\n\nThanks for your payment of {amount} for {center_name}.\n\n"
        "View receipt: {receipt_url}\nManage billing: {billing_url}\n",
    ),
    "subscription_renewed": (
        "Your subscription renewed successfully",
        "Hi {name},\n\nWe successfully renewed your subscription for {center_name}.\n\n"
        "Amount: {amount}\nNext renewal: {renewal_date}\n\n"
        "Manage billing: {billing_url}\n",
    ),
    "renewal_reminder": (
        "Your subscription renews in {days_left} day(s)",
        "Hi {name},\n\nYour subscription for {center_name} renews on {renewal_date} "
        "(about {days_left} day(s) from now).\n\n"
        "Manage billing: {billing_url}\n",
    ),
    "dunning": (
        "Update payment before your listing downgrades",
        "Hi {name},\n\nWe could not renew your subscription for {center_name}.\n\n"
        "Update your card here before access ends: {billing_url}\n",
    ),
    "cancellation": (
        "Your subscription cancellation is confirmed",
        "Hi {name},\n\nYour subscription for {center_name} will end on {access_end}.\n\n"
        "Until then you keep full access. After that the listing reverts to the basic view.\n"
        "Resubscribe anytime: {billing_url}\n",
    ),
    "subscription_expired": (
        "Your paid listing access has ended",
        "Hi {name},\n\nPaid access for {center_name} has ended and the listing is back on the basic view.\n\n"
        "Resubscribe anytime to restore your full profile and dashboard:\n{billing_url}\n",
    ),
    "win_back": (
        "Resubscribe — everything restores instantly",
        "Hi {name},\n\nYour listing {center_name} is back on the basic view.\n\n"
        "Resubscribe to restore your full profile and dashboard: {billing_url}\n",
    ),
    "new_lead_alert": (
        "New inquiry for {center_name}",
        "You have a new lead.\n\nName: {lead_name}\nEmail: {lead_email}\nPhone: {lead_phone}\n"
        "Message:\n{lead_message}\n\nSource: {source_url}\nOpen inbox: {inbox_url}\n",
    ),
    "lead_reply": (
        "{center_name} replied to your inquiry",
        "Hi {lead_name},\n\n{reply_message}\n\n— {center_name}\n",
    ),
    "profile_published": (
        "Your listing changes are live",
        "Hi {name},\n\nUpdates to {center_name} are now published:\n{listing_url}\n",
    ),
    "upsell_receipt": (
        "Receipt — {product_label}",
        "Hi {name},\n\nThanks for purchasing {product_label} for {center_name}.\n\n"
        "Amount: {amount}\nOrder id: {order_id}\n\n"
        "Manage your listing: {login_url}\nBilling: {billing_url}\n",
    ),
    "upsell_fulfilled": (
        "Your {product_label} is ready",
        "Hi {name},\n\nGreat news — {product_label} for {center_name} is complete.\n\n"
        "View your listing: {listing_url}\nDashboard: {login_url}\n",
    ),
    "upsell_human_lead": (
        "Hot content upsell lead — {product_label}",
        "Internal alert: {name} ({email}) purchased interest in {product_label} for {center_name}.\n"
        "Order id: {order_id}\nRoute to senior / PJ to close.\n",
    ),
    "product_updates": (
        "What's new in the directory",
        "Hi {name},\n\nHere's a quick update from {site_name}.\n\n{product_update_body}\n\n"
        "Explore your dashboard: {login_url}\n",
    ),
}

# Back-compat alias used across the codebase
TEMPLATES = DEFAULT_TEMPLATES

PREFERENCE_BY_TEMPLATE = {
    "new_lead_alert": "lead_alerts",
    "dunning": "billing_alerts",
    "cancellation": "billing_alerts",
    "payment_receipt": "billing_alerts",
    "subscription_renewed": "billing_alerts",
    "subscription_expired": "billing_alerts",
    "renewal_reminder": "renewal_reminders",
    "product_updates": "product_updates",
    "upsell_receipt": "billing_alerts",
    "upsell_fulfilled": "product_updates",
}

_URL_RE = re.compile(r"(https?://[^\s<]+)")
_FORMATTER = Formatter()


class _SafeFormat(dict):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


def _safe_format(template: str, values: dict[str, Any]) -> str:
    return _FORMATTER.vformat(template, (), _SafeFormat(**{k: "" if v is None else v for k, v in values.items()}))


def get_platform_email_settings(db: Session | None) -> PlatformEmailSettings | None:
    if db is None:
        return None
    row = db.query(PlatformEmailSettings).filter(PlatformEmailSettings.id == 1).first()
    if row is None:
        row = PlatformEmailSettings(id=1)
        db.add(row)
        try:
            db.commit()
            db.refresh(row)
        except Exception:  # noqa: BLE001
            db.rollback()
            return db.query(PlatformEmailSettings).filter(PlatformEmailSettings.id == 1).first()
    return row


def _first_nonempty(*values: str | None, fallback: str = "") -> str:
    for value in values:
        if value is not None and str(value).strip():
            return str(value).strip()
    return fallback


def _absolute_asset_url(url: str) -> str:
    if not url:
        return url
    if url.startswith("http://") or url.startswith("https://"):
        return url
    base = settings.public_site_url.rstrip("/")
    return f"{base}{url if url.startswith('/') else '/' + url}"


def resolve_email_delivery(db: Session | None = None) -> dict[str, Any]:
    """Merge DB platform settings over env defaults."""
    row = get_platform_email_settings(db)
    provider = (row.provider if row and row.provider else "auto").strip().lower() or "auto"

    email_from = _first_nonempty(row.email_from if row else None, settings.email_from)
    postal_address = _first_nonempty(row.postal_address if row else None, settings.postal_address)
    site_name = _first_nonempty(row.site_name if row else None, fallback="Struggling With Addiction")
    default_logo = f"{settings.public_site_url.rstrip('/')}/images/SWA-logo-web-white-small_vSE-1.webp"
    logo_url = _absolute_asset_url(
        _first_nonempty(row.logo_url if row else None, fallback=default_logo)
    )

    resend_key = _first_nonempty(row.resend_api_key if row else None, settings.resend_api_key)
    smtp_host = _first_nonempty(row.smtp_host if row else None, settings.smtp_host)
    smtp_port = (row.smtp_port if row and row.smtp_port else None) or settings.smtp_port or 587
    smtp_user = _first_nonempty(row.smtp_user if row else None, settings.smtp_user)
    smtp_password = _first_nonempty(row.smtp_password if row else None, settings.smtp_password)
    smtp_use_tls = row.smtp_use_tls if row is not None else settings.smtp_use_tls

    if provider == "gmail_smtp":
        smtp_host = GMAIL_SMTP_HOST
        smtp_port = GMAIL_SMTP_PORT
        smtp_use_tls = True

    social = {
        "facebook": _first_nonempty(row.social_facebook if row else None, fallback=DEFAULT_SOCIAL["facebook"]),
        "twitter": _first_nonempty(row.social_twitter if row else None, fallback=DEFAULT_SOCIAL["twitter"]),
        "youtube": _first_nonempty(row.social_youtube if row else None, fallback=DEFAULT_SOCIAL["youtube"]),
        "instagram": _first_nonempty(row.social_instagram if row else None, fallback=DEFAULT_SOCIAL["instagram"]),
        "linkedin": _first_nonempty(row.social_linkedin if row else None, fallback=DEFAULT_SOCIAL["linkedin"]),
    }

    if provider == "resend":
        effective = "resend" if resend_key else "none"
    elif provider in ("gmail_smtp", "smtp"):
        effective = "smtp" if smtp_host else "none"
    elif resend_key:
        effective = "resend"
    elif smtp_host:
        effective = "smtp"
    else:
        effective = "none"

    ops_email = _first_nonempty(settings.upsell_alert_email, settings.admin_bootstrap_email, email_from)

    return {
        "provider": provider,
        "effective_provider": effective,
        "email_from": email_from,
        "postal_address": postal_address,
        "site_name": site_name,
        "logo_url": logo_url,
        "resend_api_key": resend_key,
        "smtp_host": smtp_host,
        "smtp_port": int(smtp_port),
        "smtp_user": smtp_user,
        "smtp_password": smtp_password,
        "smtp_use_tls": bool(smtp_use_tls),
        "social": social,
        "ops_email": ops_email,
        "env_resend_configured": bool(settings.resend_api_key),
        "env_smtp_configured": bool(settings.smtp_host),
    }


def default_template_context(to_email: str = "preview@example.com", db: Session | None = None) -> dict[str, Any]:
    delivery = resolve_email_delivery(db)
    return {
        "name": "Alex Example",
        "center_name": "Sunrise Recovery Center",
        "claim_for": " to manage Sunrise Recovery Center",
        "ticket": "SWA-1001",
        "listing_url": f"{settings.public_site_url.rstrip('/')}/rehabs",
        "claim_url": f"{settings.public_site_url.rstrip('/')}/claim-status/SWA-1001",
        "login_url": f"{settings.public_site_url.rstrip('/')}/portal",
        "billing_url": f"{settings.admin_site_url.rstrip('/')}/client/billing",
        "receipt_url": f"{settings.admin_site_url.rstrip('/')}/client/billing",
        "support_email": delivery["email_from"],
        "postal_address": delivery["postal_address"],
        "unsubscribe_url": f"{settings.public_site_url.rstrip('/')}/privacy",
        "verify_url": settings.admin_site_url,
        "confirmation_url": f"{settings.admin_site_url.rstrip('/')}/confirm-email?token=preview",
        "reset_url": f"{settings.admin_site_url.rstrip('/')}/reset-password?token=preview",
        "inbox_url": f"{settings.admin_site_url.rstrip('/')}/client/leads",
        "admin_claims_url": f"{settings.admin_site_url.rstrip('/')}/admin/claims",
        "admin_submissions_url": f"{settings.admin_site_url.rstrip('/')}/admin/submissions",
        "submission_id": "42",
        "location": "123 Main St, Austin, Texas 78701",
        "services": "Medical Detox, IOP (Intensive Outpatient)",
        "insurances": "Aetna, Blue Cross Blue Shield",
        "description": "Licensed dual-diagnosis treatment center serving Central Texas.",
        "lead_name": "Jordan Visitor",
        "lead_email": "jordan@example.com",
        "lead_phone": "(555) 010-2000",
        "lead_message": "Looking for outpatient support for a family member.",
        "reply_message": "Thanks for reaching out — our admissions team will call you today.",
        "source_url": f"{settings.public_site_url.rstrip('/')}/rehabs",
        "amount": "$9.99",
        "access_end": "August 24, 2026",
        "renewal_date": "August 1, 2026",
        "days_left": "7",
        "product_label": "Featured Article",
        "product_update_body": "We improved listing analytics and lead routing for claimed centers.",
        "admin_notes": "Please contact support if you believe this was in error.",
        "otp_code": "123456",
        "email": to_email,
        "order_id": "upsell_42",
        "site_name": delivery["site_name"],
        "logo_url": delivery["logo_url"],
        "year": str(datetime.now().year),
    }


def get_template_content(template_key: str, db: Session | None = None) -> dict[str, Any]:
    if template_key not in DEFAULT_TEMPLATES:
        raise KeyError(template_key)
    default_subject, default_body = DEFAULT_TEMPLATES[template_key]
    override = None
    if db is not None:
        override = db.query(EmailTemplateOverride).filter(EmailTemplateOverride.key == template_key).first()
    subject = override.subject if override else default_subject
    body = override.body if override else default_body
    return {
        "key": template_key,
        "subject": subject,
        "body": body,
        "default_subject": default_subject,
        "default_body": default_body,
        "is_custom": override is not None,
    }


def save_template_content(db: Session, template_key: str, subject: str, body: str) -> dict[str, Any]:
    if template_key not in DEFAULT_TEMPLATES:
        raise KeyError(template_key)
    row = db.query(EmailTemplateOverride).filter(EmailTemplateOverride.key == template_key).first()
    if row is None:
        row = EmailTemplateOverride(key=template_key, subject=subject, body=body)
        db.add(row)
    else:
        row.subject = subject
        row.body = body
    db.commit()
    db.refresh(row)
    return get_template_content(template_key, db)


def reset_template_content(db: Session, template_key: str) -> dict[str, Any]:
    if template_key not in DEFAULT_TEMPLATES:
        raise KeyError(template_key)
    row = db.query(EmailTemplateOverride).filter(EmailTemplateOverride.key == template_key).first()
    if row is not None:
        db.delete(row)
        db.commit()
    return get_template_content(template_key, db)


def _linkify_plain(text: str) -> str:
    escaped = html.escape(text)
    return _URL_RE.sub(
        lambda m: f'<a href="{m.group(1)}" style="color:#1a5f7a;text-decoration:underline;">{m.group(1)}</a>',
        escaped,
    )


def _body_to_html_paragraphs(body: str) -> str:
    chunks = [chunk.strip() for chunk in body.strip().split("\n\n") if chunk.strip()]
    if not chunks:
        return ""
    parts: list[str] = []
    for chunk in chunks:
        lines = "<br>\n".join(_linkify_plain(line) for line in chunk.split("\n"))
        parts.append(
            f'<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2933;">{lines}</p>'
        )
    return "\n".join(parts)


def render_email_html(
    body_text: str,
    *,
    db: Session | None = None,
    site_name: str | None = None,
    logo_url: str | None = None,
    postal_address: str | None = None,
    social: dict[str, str] | None = None,
) -> str:
    delivery = resolve_email_delivery(db)
    brand = site_name or delivery["site_name"]
    logo = logo_url or delivery["logo_url"]
    address = postal_address or delivery["postal_address"]
    links = social or delivery["social"]
    year = datetime.now().year

    social_bits: list[str] = []
    for label, key in (
        ("Facebook", "facebook"),
        ("X", "twitter"),
        ("YouTube", "youtube"),
        ("Instagram", "instagram"),
        ("LinkedIn", "linkedin"),
    ):
        href = (links.get(key) or "").strip()
        if not href:
            continue
        social_bits.append(
            f'<a href="{html.escape(href)}" style="color:#cbd5e1;text-decoration:none;margin:0 8px;">'
            f"{html.escape(label)}</a>"
        )
    social_html = (
        f'<p style="margin:0 0 12px;font-size:13px;line-height:1.5;">{"".join(social_bits)}</p>'
        if social_bits
        else ""
    )

    logo_html = (
        f'<img src="{html.escape(logo)}" alt="{html.escape(brand)}" '
        f'width="180" style="display:block;max-width:180px;height:auto;border:0;" />'
        if logo
        else f'<span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">'
        f"{html.escape(brand)}</span>"
    )

    body_html = _body_to_html_paragraphs(body_text)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html.escape(brand)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f5;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:4px;overflow:hidden;">
          <tr>
            <td style="background:#0f2a36;padding:28px 32px;text-align:left;">
              {logo_html}
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
              {body_html}
            </td>
          </tr>
          <tr>
            <td style="background:#0f2a36;padding:24px 32px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
              {social_html}
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
                &copy; {year} {html.escape(brand)}. All rights reserved.
              </p>
              <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#64748b;">
                {html.escape(address)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def list_template_catalog(db: Session | None = None) -> list[dict[str, Any]]:
    sample = default_template_context(db=db)
    catalog: list[dict[str, Any]] = []
    for key in DEFAULT_TEMPLATES:
        meta = TEMPLATE_META.get(key, {})
        content = get_template_content(key, db)
        variables = sorted(set(re.findall(r"\{(\w+)\}", content["subject"] + content["body"])))
        catalog.append(
            {
                "key": key,
                "label": meta.get("label", key),
                "description": meta.get("description", ""),
                "category": meta.get("category", "other"),
                "preference_gate": PREFERENCE_BY_TEMPLATE.get(key),
                "sample_subject": _safe_format(content["subject"], sample),
                "subject": content["subject"],
                "body": content["body"],
                "default_subject": content["default_subject"],
                "default_body": content["default_body"],
                "is_custom": content["is_custom"],
                "variables": variables,
            }
        )
    return catalog


def render_template(
    template_key: str,
    context: dict[str, Any] | None = None,
    *,
    db: Session | None = None,
    to_email: str = "preview@example.com",
    subject_override: str | None = None,
    body_override: str | None = None,
) -> tuple[str, str, str]:
    if template_key not in DEFAULT_TEMPLATES:
        raise KeyError(template_key)
    defaults = default_template_context(to_email=to_email, db=db)
    if context:
        defaults.update({k: v for k, v in context.items() if v is not None})
    content = get_template_content(template_key, db)
    subject_tmpl = subject_override if subject_override is not None else content["subject"]
    body_tmpl = body_override if body_override is not None else content["body"]
    subject = _safe_format(subject_tmpl, defaults)
    text = _safe_format(body_tmpl, defaults)
    html_body = render_email_html(text, db=db)
    return subject, text, html_body


def _send_smtp(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
    delivery: dict[str, Any],
) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = delivery["email_from"]
    msg["To"] = to_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")
    with smtplib.SMTP(delivery["smtp_host"], delivery["smtp_port"], timeout=20) as smtp:
        if delivery["smtp_use_tls"]:
            smtp.starttls()
        if delivery["smtp_user"]:
            smtp.login(delivery["smtp_user"], delivery["smtp_password"] or "")
        smtp.send_message(msg)


def _send_resend(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
    delivery: dict[str, Any],
) -> None:
    payload = json.dumps(
        {
            "from": delivery["email_from"],
            "to": [to_email],
            "subject": subject,
            "text": text_body,
            "html": html_body,
        }
    ).encode("utf-8")
    req = request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {delivery['resend_api_key']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=20) as resp:
            if resp.status >= 300:
                raise RuntimeError(f"Resend HTTP {resp.status}")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Resend HTTP {exc.code}: {detail}") from exc


def send_email(
    db: Session | None,
    *,
    to_email: str,
    template_key: str,
    context: dict[str, Any] | None = None,
    user_id: int | None = None,
    rehab_center_id: int | None = None,
    respect_preferences: bool = True,
    meta: dict[str, Any] | None = None,
) -> bool:
    context = context or {}
    delivery = resolve_email_delivery(db)
    defaults = default_template_context(to_email=to_email, db=db)
    defaults.update({k: v for k, v in context.items() if v is not None})

    if template_key not in DEFAULT_TEMPLATES:
        logger.warning("Unknown email template %s", template_key)
        return False

    preference = PREFERENCE_BY_TEMPLATE.get(template_key) if respect_preferences else None
    if preference and db is not None and user_id:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if profile and (profile.notification_preferences or {}).get(preference) is False:
            content = get_template_content(template_key, db)
            db.add(
                EmailLog(
                    to_email=to_email,
                    template_key=template_key,
                    subject=content["subject"],
                    status="skipped",
                    error=f"{preference} disabled by user",
                    user_id=user_id,
                    rehab_center_id=rehab_center_id,
                )
            )
            db.commit()
            return False

    try:
        subject, body, html_body = render_template(template_key, defaults, db=db, to_email=to_email)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Email template render failed %s: %s", template_key, exc)
        return False

    status = "sent"
    err_text = None
    try:
        if delivery["effective_provider"] == "resend":
            _send_resend(to_email, subject, body, html_body, delivery)
        elif delivery["effective_provider"] == "smtp":
            _send_smtp(to_email, subject, body, html_body, delivery)
        else:
            status = "skipped"
            logger.info("EMAIL[%s] to=%s subject=%s\n%s", template_key, to_email, subject, body)
    except Exception as exc:  # noqa: BLE001
        status = "failed"
        err_text = str(exc)
        logger.exception("Failed sending email %s to %s", template_key, to_email)

    if db is not None:
        log_meta = meta if meta is not None else defaults
        db.add(
            EmailLog(
                to_email=to_email,
                template_key=template_key,
                subject=subject,
                status=status,
                error=err_text,
                user_id=user_id,
                rehab_center_id=rehab_center_id,
                meta_json=json.dumps(log_meta, default=str)[:4000],
            )
        )
        try:
            db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()
            logger.exception("Failed to persist email log")

    return status == "sent" or status == "skipped"
