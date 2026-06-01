from sqlalchemy.orm import Session

from app.models.scrape_settings import ScrapeSettings


def get_scrape_settings(db: Session) -> ScrapeSettings:
    row = db.query(ScrapeSettings).filter(ScrapeSettings.id == 1).first()
    if not row:
        row = ScrapeSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def mask_api_key(key: str | None) -> str | None:
    if not key:
        return None
    if len(key) <= 8:
        return "••••••••"
    return f"{key[:4]}…{key[-4:]}"
