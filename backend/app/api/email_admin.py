"""Admin platform email settings, templates, activity logs, and resend."""
from __future__ import annotations

import json
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.deps import AdminUser
from app.database import get_db
from app.models.email_log import EmailLog
from app.schemas.email_settings import (
    EmailResendIn,
    EmailTemplatePreviewIn,
    EmailTemplatePreviewOut,
    EmailTemplateSummary,
    EmailTemplateUpdate,
    EmailTestSendIn,
    PlatformEmailSettingsOut,
    PlatformEmailSettingsUpdate,
)
from app.services.email import (
    GMAIL_SMTP_HOST,
    GMAIL_SMTP_PORT,
    DEFAULT_TEMPLATES,
    get_platform_email_settings,
    list_template_catalog,
    ping_resend,
    render_template,
    reset_template_content,
    resolve_email_delivery,
    save_template_content,
    send_email,
    _sanitize_secret,
)
from app.services.mailchimp import list_audiences, ping_audience, resolve_mailchimp
from app.services.storage import get_public_url, upload_file

router = APIRouter(tags=["email-admin"])


def _settings_out(db: Session) -> PlatformEmailSettingsOut:
    row = get_platform_email_settings(db)
    delivery = resolve_email_delivery(db)
    mailchimp = resolve_mailchimp(db)
    db_resend = _sanitize_secret(row.resend_api_key if row else None)
    db_smtp_password = _sanitize_secret(row.smtp_password if row else None)
    db_mailchimp = _sanitize_secret(row.mailchimp_api_key if row else None)
    stored_provider = ((row.provider if row and row.provider else None) or delivery["provider"] or "auto").strip().lower()
    return PlatformEmailSettingsOut(
        provider=stored_provider,
        email_from=delivery["email_from"],
        postal_address=delivery["postal_address"],
        site_name=delivery["site_name"],
        logo_url=delivery["logo_url"],
        resend_api_key=db_resend or None,
        resend_api_key_set=bool(db_resend) or delivery["env_resend_configured"],
        resend_key_source=delivery.get("resend_key_source"),
        smtp_host=delivery["smtp_host"] or None,
        smtp_port=delivery["smtp_port"],
        smtp_user=delivery["smtp_user"] or None,
        smtp_password=db_smtp_password or None,
        smtp_password_set=bool(db_smtp_password or delivery["smtp_password"]),
        smtp_use_tls=delivery["smtp_use_tls"],
        social_facebook=delivery["social"]["facebook"] or None,
        social_twitter=delivery["social"]["twitter"] or None,
        social_youtube=delivery["social"]["youtube"] or None,
        social_instagram=delivery["social"]["instagram"] or None,
        social_linkedin=delivery["social"]["linkedin"] or None,
        effective_provider=delivery["effective_provider"],
        env_resend_configured=delivery["env_resend_configured"],
        env_smtp_configured=delivery["env_smtp_configured"],
        mailchimp_enabled=mailchimp["enabled"],
        mailchimp_api_key=db_mailchimp or None,
        mailchimp_api_key_set=bool(db_mailchimp or mailchimp["api_key"]),
        mailchimp_audience_id=mailchimp["audience_id"] or None,
        mailchimp_configured=mailchimp["configured"],
        env_mailchimp_configured=mailchimp["env_configured"],
        abandonment_emails_enabled=mailchimp["abandonment_emails_enabled"],
        inquiry_forms_enabled=bool(getattr(row, "inquiry_forms_enabled", True)) if row else True,
    )


@router.get("/api/admin/email-settings", response_model=PlatformEmailSettingsOut)
def get_email_settings(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    return _settings_out(db)


@router.patch("/api/admin/email-settings", response_model=PlatformEmailSettingsOut)
def update_email_settings(
    body: PlatformEmailSettingsUpdate,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    row = get_platform_email_settings(db)
    if row is None:
        raise HTTPException(status_code=500, detail="Unable to load email settings")

    data = body.model_dump(exclude_unset=True)
    clear_resend = data.pop("clear_resend_api_key", False)
    clear_smtp = data.pop("clear_smtp_password", False)
    clear_mailchimp = data.pop("clear_mailchimp_api_key", False)
    resend_key = data.pop("resend_api_key", None)
    smtp_password = data.pop("smtp_password", None)
    mailchimp_key = data.pop("mailchimp_api_key", None)

    provider = data.get("provider")
    if provider == "gmail_smtp":
        data.setdefault("smtp_host", GMAIL_SMTP_HOST)
        data.setdefault("smtp_port", GMAIL_SMTP_PORT)
        data.setdefault("smtp_use_tls", True)
        # Force Gmail host when explicitly choosing Gmail.
        data["smtp_host"] = GMAIL_SMTP_HOST
        data["smtp_port"] = GMAIL_SMTP_PORT
        data["smtp_use_tls"] = True

    for key, value in data.items():
        setattr(row, key, value)

    if clear_resend:
        row.resend_api_key = None
    elif resend_key is not None:
        cleaned = _sanitize_secret(resend_key)
        if cleaned:
            if not cleaned.startswith("re_"):
                raise HTTPException(
                    status_code=400,
                    detail="Resend API keys start with re_. Paste the full key from resend.com/api-keys.",
                )
            row.resend_api_key = cleaned

    if clear_smtp:
        row.smtp_password = None
    elif smtp_password is not None:
        cleaned_smtp = _sanitize_secret(smtp_password)
        if cleaned_smtp:
            row.smtp_password = cleaned_smtp

    if clear_mailchimp:
        row.mailchimp_api_key = None
    elif mailchimp_key is not None:
        cleaned_mc = _sanitize_secret(mailchimp_key)
        if cleaned_mc:
            row.mailchimp_api_key = cleaned_mc

    db.add(row)
    db.commit()
    db.refresh(row)
    return _settings_out(db)


@router.post("/api/admin/email-settings/logo")
async def upload_email_logo(
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Logo must be an image")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    key = upload_file(content, file.filename or "logo.png", file.content_type or "image/png")
    url = get_public_url(key)
    row = get_platform_email_settings(db)
    if row is None:
        raise HTTPException(status_code=500, detail="Unable to load email settings")
    row.logo_url = url
    db.add(row)
    db.commit()
    return {"logo_url": url, **_settings_out(db).model_dump()}


@router.post("/api/admin/email-settings/test")
def send_test_email(
    body: EmailTestSendIn,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    if body.template_key not in DEFAULT_TEMPLATES:
        raise HTTPException(status_code=400, detail=f"Unknown template: {body.template_key}")
    ok = send_email(
        db,
        to_email=str(body.to_email),
        template_key=body.template_key,
        context={"name": "Admin"},
        respect_preferences=False,
    )
    delivery = resolve_email_delivery(db)
    if not ok:
        last = (
            db.query(EmailLog)
            .filter(EmailLog.to_email == str(body.to_email))
            .order_by(EmailLog.id.desc())
            .first()
        )
        detail = (last.error if last and last.error else None) or "Test email failed"
        raise HTTPException(status_code=400, detail=detail)
    return {
        "ok": True,
        "effective_provider": delivery["effective_provider"],
        "message": f"Test email sent via {delivery['effective_provider']}",
    }


@router.post("/api/admin/email-settings/resend/ping")
def ping_resend_connection(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    try:
        return ping_resend(db)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)[:400]) from exc


@router.post("/api/admin/email-settings/mailchimp/ping")
def ping_mailchimp(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    try:
        return ping_audience(db)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)[:400]) from exc


@router.get("/api/admin/email-settings/mailchimp/audiences")
def mailchimp_audiences(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    try:
        return {"items": list_audiences(db)}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)[:400]) from exc


@router.get("/api/admin/email-templates", response_model=list[EmailTemplateSummary])
def admin_list_templates(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    return list_template_catalog(db)


@router.get("/api/admin/email-templates/{template_key}", response_model=EmailTemplateSummary)
def admin_get_template(template_key: str, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    rows = [t for t in list_template_catalog(db) if t["key"] == template_key]
    if not rows:
        raise HTTPException(status_code=404, detail="Unknown template")
    return rows[0]


@router.patch("/api/admin/email-templates/{template_key}", response_model=EmailTemplateSummary)
def admin_update_template(
    template_key: str,
    body: EmailTemplateUpdate,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    if template_key not in DEFAULT_TEMPLATES:
        raise HTTPException(status_code=404, detail="Unknown template")
    try:
        save_template_content(db, template_key, body.subject.strip(), body.body.strip())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Unknown template") from exc
    rows = [t for t in list_template_catalog(db) if t["key"] == template_key]
    return rows[0]


@router.post("/api/admin/email-templates/{template_key}/reset", response_model=EmailTemplateSummary)
def admin_reset_template(template_key: str, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    if template_key not in DEFAULT_TEMPLATES:
        raise HTTPException(status_code=404, detail="Unknown template")
    reset_template_content(db, template_key)
    rows = [t for t in list_template_catalog(db) if t["key"] == template_key]
    return rows[0]


@router.post("/api/admin/email-templates/{template_key}/preview", response_model=EmailTemplatePreviewOut)
def admin_preview_template(
    template_key: str,
    body: EmailTemplatePreviewIn,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    if template_key not in DEFAULT_TEMPLATES:
        raise HTTPException(status_code=404, detail="Unknown template")
    try:
        subject, text, html_body = render_template(
            template_key,
            body.context,
            db=db,
            subject_override=body.subject,
            body_override=body.body,
        )
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=f"Missing template variable: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid template syntax: {exc}") from exc
    return EmailTemplatePreviewOut(key=template_key, subject=subject, text=text, html=html_body)


@router.get("/api/admin/emails")
def admin_list_emails(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    logs = db.query(EmailLog).order_by(EmailLog.created_at.desc()).limit(300).all()
    return [
        {
            "id": row.id,
            "to_email": row.to_email,
            "template_key": row.template_key,
            "subject": row.subject,
            "status": row.status,
            "error": row.error,
            "user_id": row.user_id,
            "rehab_center_id": row.rehab_center_id,
            "created_at": row.created_at,
        }
        for row in logs
    ]


@router.post("/api/admin/emails/{log_id}/resend")
def admin_resend_email(
    log_id: int,
    body: EmailResendIn,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    row = db.query(EmailLog).filter(EmailLog.id == log_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Email log not found")
    if row.template_key not in DEFAULT_TEMPLATES:
        raise HTTPException(status_code=400, detail="Original template is no longer available")

    context: dict[str, Any] = {}
    if row.meta_json:
        try:
            parsed = json.loads(row.meta_json)
            if isinstance(parsed, dict):
                context = parsed
        except json.JSONDecodeError:
            context = {}

    to_email = str(body.to_email) if body.to_email else row.to_email
    ok = send_email(
        db,
        to_email=to_email,
        template_key=row.template_key,
        context=context,
        user_id=row.user_id,
        rehab_center_id=row.rehab_center_id,
        respect_preferences=False,
    )
    return {"ok": ok, "to_email": to_email, "template_key": row.template_key}
