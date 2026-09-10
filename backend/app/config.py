import os
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

CANONICAL_PUBLIC_SITE_URL = "https://strugglingwithaddiction.com"
CANONICAL_ADMIN_SITE_URL = "https://strugglingwithaddiction.com/admin"


def _running_on_railway() -> bool:
    return bool(
        os.getenv("RAILWAY_ENVIRONMENT")
        or os.getenv("RAILWAY_PROJECT_ID")
        or os.getenv("RAILWAY_SERVICE_ID")
    )


def _env_file() -> str | None:
    """Never load local .env on Railway or in production."""
    if os.getenv("ENVIRONMENT", "development").lower() == "production":
        return None
    if _running_on_railway():
        return None
    return ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_file(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://swa:swa_dev_password@localhost:5432/swa"

    @property
    def sqlalchemy_database_url(self) -> str:
        """Railway/Heroku often provide postgres:// — SQLAlchemy needs postgresql://."""
        url = self.database_url
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql://", 1)
        return url
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    cors_origins: str = "http://localhost:5317,http://127.0.0.1:5317,http://localhost:5180,http://127.0.0.1:5180"
    admin_bootstrap_email: str = "admin@example.com"
    admin_bootstrap_password: str = "changeme123"
    import_users_default_password: str = "ChangeMeOnFirstLogin!"
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    # Live catalog on acct_1UDvsr7916C3OAmE (Struggling With Addiction). Override via env/DB.
    stripe_price_monthly: str = "price_1UDycl7916C3OAmE5bi5arRn"
    stripe_price_yearly: str = "price_1UDycm7916C3OAmEozHX6ini"
    stripe_mode: str = "live"
    stripe_test_secret_key: str = ""
    stripe_test_webhook_secret: str = ""
    stripe_test_publishable_key: str = ""
    stripe_test_price_monthly: str = ""
    stripe_test_price_yearly: str = ""
    stripe_test_price_verified_badge: str = ""
    stripe_test_price_featured_placement: str = ""
    public_site_url: str = "http://127.0.0.1:5317"
    admin_site_url: str = "http://127.0.0.1:5180"
    s3_endpoint_url: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_bucket_name: str = "swa-uploads"
    s3_public_url: str = ""
    upload_dir: str = "uploads"
    environment: str = "development"
    # Email (Resend preferred; SMTP fallback; otherwise logs to console)
    resend_api_key: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    email_from: str = "noreply@strugglingwithaddiction.com"
    postal_address: str = "Struggling With Addiction, USA"
    # Upsell Stripe price IDs (optional; human products can be request-only)
    stripe_price_verified_badge: str = "price_1UDycw7916C3OAmEQICZf0D6"
    stripe_price_featured_placement: str = "price_1UDycw7916C3OAmEgDDwytP9"
    # Mailchimp Marketing API (optional; admin can also set these on Emails → Settings)
    mailchimp_api_key: str = ""
    mailchimp_audience_id: str = ""
    # Internal alerts for human-closed upsells
    upsell_alert_email: str = ""
    # Phone ownership callback (Twilio SMS). Without credentials codes are logged locally.
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    # Optional — enables live Google review feed on rehab detail pages
    google_places_api_key: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def uses_local_database(self) -> bool:
        url = self.database_url.lower()
        return "localhost" in url or "127.0.0.1" in url

    @model_validator(mode="after")
    def require_remote_database_on_deploy(self) -> "Settings":
        if self.uses_local_database and (self.is_production or _running_on_railway()):
            raise ValueError(
                "DATABASE_URL points at localhost. On Railway: add PostgreSQL, open the API "
                "service → Variables → Add Reference → Postgres → DATABASE_URL, set "
                "ENVIRONMENT=production, then redeploy. Or run: ./backend/scripts/railway-setup.sh"
            )
        return self

    @model_validator(mode="after")
    def canonicalize_custom_domain(self) -> "Settings":
        """Never keep the Railway hostname once the custom domain is live."""
        if "railway.app" in (self.public_site_url or ""):
            self.public_site_url = CANONICAL_PUBLIC_SITE_URL
        if "railway.app" in (self.admin_site_url or ""):
            self.admin_site_url = CANONICAL_ADMIN_SITE_URL
        if self.is_production or _running_on_railway():
            if not self.public_site_url or "127.0.0.1" in self.public_site_url or "localhost" in self.public_site_url:
                self.public_site_url = CANONICAL_PUBLIC_SITE_URL
            if not self.admin_site_url or "127.0.0.1" in self.admin_site_url or "localhost" in self.admin_site_url:
                self.admin_site_url = CANONICAL_ADMIN_SITE_URL
            extras = (
                CANONICAL_PUBLIC_SITE_URL,
                CANONICAL_ADMIN_SITE_URL,
                "https://www.strugglingwithaddiction.com",
                "https://www.strugglingwithaddiction.com/admin",
            )
            origins: list[str] = []
            for item in self.cors_origin_list:
                if "railway.app" in item:
                    origins.append(CANONICAL_PUBLIC_SITE_URL)
                    origins.append(CANONICAL_ADMIN_SITE_URL)
                else:
                    origins.append(item)
            origins.extend(extras)
            seen: set[str] = set()
            cleaned: list[str] = []
            for item in origins:
                if item in seen:
                    continue
                seen.add(item)
                cleaned.append(item)
            self.cors_origins = ",".join(cleaned)
        return self

    @property
    def s3_configured(self) -> bool:
        return bool(self.s3_endpoint_url and self.s3_access_key_id and self.s3_secret_access_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
