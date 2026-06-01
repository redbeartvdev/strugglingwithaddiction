from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class BlogSettings(Base, TimestampMixin):
    __tablename__ = "blog_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    trash_retention_months: Mapped[int] = mapped_column(Integer, default=6)
