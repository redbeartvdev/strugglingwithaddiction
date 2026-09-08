from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


class PlatformEmailSettingsOut(BaseModel):
    provider: str
    email_from: str
    postal_address: str
    site_name: str
    logo_url: str | None
    resend_api_key_set: bool
    smtp_host: str | None
    smtp_port: int
    smtp_user: str | None
    smtp_password_set: bool
    smtp_use_tls: bool
    social_facebook: str | None
    social_twitter: str | None
    social_youtube: str | None
    social_instagram: str | None
    social_linkedin: str | None
    effective_provider: str
    env_resend_configured: bool
    env_smtp_configured: bool
    mailchimp_enabled: bool = False
    mailchimp_api_key_set: bool = False
    mailchimp_audience_id: str | None = None
    mailchimp_configured: bool = False
    env_mailchimp_configured: bool = False
    abandonment_emails_enabled: bool = True
    inquiry_forms_enabled: bool = True


class PlatformEmailSettingsUpdate(BaseModel):
    provider: Literal["auto", "resend", "gmail_smtp", "smtp"] | None = None
    email_from: str | None = None
    postal_address: str | None = None
    site_name: str | None = None
    logo_url: str | None = None
    resend_api_key: str | None = None
    clear_resend_api_key: bool = False
    smtp_host: str | None = None
    smtp_port: int | None = Field(default=None, ge=1, le=65535)
    smtp_user: str | None = None
    smtp_password: str | None = None
    clear_smtp_password: bool = False
    smtp_use_tls: bool | None = None
    social_facebook: str | None = None
    social_twitter: str | None = None
    social_youtube: str | None = None
    social_instagram: str | None = None
    social_linkedin: str | None = None
    mailchimp_enabled: bool | None = None
    mailchimp_api_key: str | None = None
    clear_mailchimp_api_key: bool = False
    mailchimp_audience_id: str | None = None
    abandonment_emails_enabled: bool | None = None
    inquiry_forms_enabled: bool | None = None


class EmailTemplateSummary(BaseModel):
    key: str
    label: str
    description: str
    category: str = "other"
    preference_gate: str | None = None
    sample_subject: str
    subject: str
    body: str
    default_subject: str
    default_body: str
    is_custom: bool = False
    variables: list[str]
    routed_to_mailchimp: bool = False


class EmailTemplateUpdate(BaseModel):
    subject: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1)


class EmailTemplatePreviewIn(BaseModel):
    context: dict[str, Any] | None = None
    subject: str | None = None
    body: str | None = None


class EmailTemplatePreviewOut(BaseModel):
    key: str
    subject: str
    text: str
    html: str


class EmailTestSendIn(BaseModel):
    to_email: EmailStr
    template_key: str = "email_confirmation"


class EmailResendIn(BaseModel):
    to_email: EmailStr | None = None
