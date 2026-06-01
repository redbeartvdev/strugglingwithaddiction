from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ScrapeSettings(Base, TimestampMixin):
    __tablename__ = "scrape_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    openai_api_key: Mapped[str | None] = mapped_column(nullable=True)
    kimi_api_key: Mapped[str | None] = mapped_column(nullable=True)
    claude_api_key: Mapped[str | None] = mapped_column(nullable=True)
    gemini_api_key: Mapped[str | None] = mapped_column(nullable=True)
    preferred_provider: Mapped[str | None] = mapped_column(nullable=True)
