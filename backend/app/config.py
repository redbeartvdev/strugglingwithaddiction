import os
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    cors_origins: str = "http://localhost:5173,http://localhost:5174"
    admin_bootstrap_email: str = "admin@example.com"
    admin_bootstrap_password: str = "changeme123"
    import_users_default_password: str = "ChangeMeOnFirstLogin!"
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_monthly: str = ""
    stripe_price_yearly: str = ""
    public_site_url: str = "http://localhost:5173"
    admin_site_url: str = "http://localhost:5174"
    s3_endpoint_url: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_bucket_name: str = "swa-uploads"
    s3_public_url: str = ""
    upload_dir: str = "uploads"
    environment: str = "development"

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

    @property
    def s3_configured(self) -> bool:
        return bool(self.s3_endpoint_url and self.s3_access_key_id and self.s3_secret_access_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
