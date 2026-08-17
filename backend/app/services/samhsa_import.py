"""CSV template + bulk import for SAMHSA-seeded rehab listings."""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models.rehab import CenterSource, ListingStatus, RehabCenter

CSV_HEADERS = [
    "samhsa_id",
    "name",
    "address_line",
    "city",
    "state",
    "zip",
    "phone",
    "website",
    "outreach_email",
    "contact_email",
    "description",
    "specialties",
    "levels_of_care",
    "insurances",
    "amenities",
    "accreditations",
    "google_maps_url",
    "google_reviews_url",
    "rating",
]

TEMPLATE_EXAMPLE_ROW = {
    "samhsa_id": "SAMHSA-AZ-0001",
    "name": "Example Recovery Center",
    "address_line": "123 Main St",
    "city": "Phoenix",
    "state": "Arizona",
    "zip": "85001",
    "phone": "602-555-0100",
    "website": "https://example-recovery.com",
    "outreach_email": "admissions@example-recovery.com",
    "contact_email": "info@example-recovery.com",
    "description": "Basic SAMHSA-seeded listing. Centers claim and expand this profile.",
    "specialties": "Detox|Residential|IOP",
    "levels_of_care": "Detox|Inpatient|Outpatient",
    "insurances": "Medicaid",
    "amenities": "Private rooms|Fitness",
    "accreditations": "Joint Commission|CARF",
    "google_maps_url": "https://maps.google.com/?q=Phoenix+AZ",
    "google_reviews_url": "",
    "rating": "4.5",
}


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return s[:200] or "center"


def _split_list(value: str | None) -> list[str]:
    if not value or not str(value).strip():
        return []
    parts = re.split(r"[|;,]", str(value))
    return [p.strip() for p in parts if p.strip()]


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def _location_display(city: str | None, state: str | None) -> str:
    parts = [p for p in (city, state) if p]
    return ", ".join(parts)


def _unique_slug(db: Session, base: str, exclude_id: int | None = None) -> str:
    slug = base
    n = 1
    while True:
        q = db.query(RehabCenter).filter(RehabCenter.slug == slug)
        if exclude_id is not None:
            q = q.filter(RehabCenter.id != exclude_id)
        if not q.first():
            return slug
        slug = f"{base}-{n}"
        n += 1


def build_template_csv() -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=CSV_HEADERS, lineterminator="\n")
    writer.writeheader()
    writer.writerow(TEMPLATE_EXAMPLE_ROW)
    return buf.getvalue()


@dataclass
class ImportResult:
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)
    total_rows: int = 0


def _find_existing(db: Session, samhsa_id: str | None, name: str, city: str | None, state: str | None) -> RehabCenter | None:
    if samhsa_id:
        found = db.query(RehabCenter).filter(RehabCenter.samhsa_id == samhsa_id).first()
        if found:
            return found
    q = db.query(RehabCenter).filter(RehabCenter.name.ilike(name.strip()))
    if city:
        q = q.filter(RehabCenter.city.ilike(city.strip()))
    if state:
        q = q.filter(RehabCenter.state.ilike(state.strip()))
    return q.first()


def import_centers_csv(db: Session, content: str | bytes, *, publish: bool = True) -> ImportResult:
    if isinstance(content, bytes):
        text = content.decode("utf-8-sig")
    else:
        text = content
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return ImportResult(errors=["CSV is empty or missing a header row."])

    headers = [h.strip().lower() for h in reader.fieldnames if h]
    missing = [h for h in ("name",) if h not in headers]
    if missing:
        return ImportResult(errors=[f"Missing required column(s): {', '.join(missing)}"])

    result = ImportResult()
    for i, raw in enumerate(reader, start=2):
        result.total_rows += 1
        row = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()}
        name = row.get("name") or ""
        if not name:
            result.skipped += 1
            result.errors.append(f"Row {i}: name is required — skipped")
            continue

        samhsa_id = _clean(row.get("samhsa_id"))
        city = _clean(row.get("city"))
        state = _clean(row.get("state"))
        try:
            rating_raw = _clean(row.get("rating"))
            rating = float(rating_raw) if rating_raw else 5.0
            if rating < 0 or rating > 5:
                rating = 5.0
        except ValueError:
            rating = 5.0
            result.errors.append(f"Row {i}: invalid rating — defaulted to 5.0")

        fields = {
            "name": name,
            "address_line": _clean(row.get("address_line")),
            "city": city,
            "state": state,
            "zip": _clean(row.get("zip")),
            "phone": _clean(row.get("phone")),
            "website": _clean(row.get("website")),
            "outreach_email": _clean(row.get("outreach_email")),
            "contact_email": _clean(row.get("contact_email")),
            "description": row.get("description") or "",
            "specialties": _split_list(row.get("specialties")),
            "levels_of_care": _split_list(row.get("levels_of_care")),
            "insurances": _split_list(row.get("insurances")),
            "amenities": _split_list(row.get("amenities")),
            "accreditations": _split_list(row.get("accreditations")),
            "google_maps_url": _clean(row.get("google_maps_url")),
            "google_reviews_url": _clean(row.get("google_reviews_url")),
            "rating": rating,
            "location_display": _location_display(city, state),
            "samhsa_id": samhsa_id,
            "source": CenterSource.imported,
        }

        existing = _find_existing(db, samhsa_id, name, city, state)
        try:
            if existing:
                # Do not overwrite claimed ownership or premium flags via import
                for key, value in fields.items():
                    if key == "samhsa_id" and existing.samhsa_id and samhsa_id and existing.samhsa_id != samhsa_id:
                        continue
                    setattr(existing, key, value)
                if publish and existing.listing_status == ListingStatus.draft and not existing.claimed:
                    existing.listing_status = ListingStatus.published
                result.updated += 1
            else:
                slug = _unique_slug(db, _slugify(name))
                center = RehabCenter(
                    slug=slug,
                    listing_status=ListingStatus.published if publish else ListingStatus.draft,
                    claimed=False,
                    contact_visible=False,
                    **fields,
                )
                db.add(center)
                result.created += 1
        except Exception as exc:  # noqa: BLE001
            result.errors.append(f"Row {i}: {exc}")
            result.skipped += 1

    db.commit()
    return result
