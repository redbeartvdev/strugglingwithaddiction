from datetime import datetime

from sqlalchemy.orm import Session

from app.models.rehab import RehabCenterClaim


def generate_claim_ticket(db: Session) -> str:
    year = datetime.now().year
    prefix = f"CLM-{year}-"
    last = (
        db.query(RehabCenterClaim)
        .filter(RehabCenterClaim.ticket_number.like(f"{prefix}%"))
        .order_by(RehabCenterClaim.id.desc())
        .first()
    )
    seq = 1
    if last:
        try:
            seq = int(last.ticket_number.split("-")[-1]) + 1
        except ValueError:
            seq = 1
    return f"{prefix}{seq:05d}"
