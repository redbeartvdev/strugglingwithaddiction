from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ServiceCodeCatalog(Base, TimestampMixin):
    """SAMHSA-style service codes available on every rehab listing."""

    __tablename__ = "service_code_catalog"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_code: Mapped[str] = mapped_column(String(16), index=True)
    category_name: Mapped[str] = mapped_column(String(120))
    service_code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    service_name: Mapped[str] = mapped_column(String(255))
    service_description: Mapped[str] = mapped_column(Text, default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
