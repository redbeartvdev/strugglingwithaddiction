#!/usr/bin/env python3
"""
Import SAMHSA / findtreatment facility records into rehab_centers.

Usage (from backend/ with venv active):
  python scripts/import_samhsa.py path/to/facilities.json
  python scripts/import_samhsa.py path/to/facilities.json --dry-run

Expected JSON: array of objects with fields such as:
  id, name1, name2, street1, city, state, zip, phone, website, services (list or string)
Or use the normalized export documented in backend/seed-data/samhsa.sample.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.rehab import CenterSource, ListingStatus, RehabCenter


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s[:200] or "facility"


def normalize_record(raw: dict) -> dict | None:
    name = (raw.get("name") or raw.get("name1") or "").strip()
    if not name:
        name = (raw.get("name2") or "").strip()
    if not name:
        return None
    city = (raw.get("city") or "").strip() or None
    state = (raw.get("state") or "").strip() or None
    zip_code = (raw.get("zip") or raw.get("zipCode") or "").strip() or None
    street = (raw.get("street1") or raw.get("address") or "").strip() or None
    parts = [p for p in [street, city, state, zip_code] if p]
    location_display = ", ".join(parts) if parts else (state or "United States")
    external_id = str(raw.get("id") or raw.get("facilityId") or raw.get("external_id") or "").strip() or None
    services = raw.get("services") or raw.get("specialties") or []
    if isinstance(services, str):
        services = [s.strip() for s in services.split(",") if s.strip()]
    insurance = raw.get("insurance") or raw.get("insurance_accepted") or []
    if isinstance(insurance, str):
        insurance = [s.strip() for s in insurance.split(",") if s.strip()]
    base_slug = slugify(f"{name}-{city or ''}-{state or ''}")
    return {
        "external_id": external_id,
        "slug": base_slug,
        "name": name,
        "description": (raw.get("description") or "").strip()
        or f"Treatment facility in {location_display}.",
        "location_display": location_display,
        "address_line": street,
        "city": city,
        "state": state,
        "zip": zip_code,
        "phone": (raw.get("phone") or raw.get("telephone") or "").strip() or None,
        "website": (raw.get("website") or raw.get("url") or "").strip() or None,
        "specialties": list(services)[:20],
        "insurance_accepted": list(insurance)[:20],
        "treatment_levels": list(raw.get("treatment_levels") or [])[:10],
        "lat": raw.get("latitude") or raw.get("lat"),
        "lng": raw.get("longitude") or raw.get("lng"),
    }


def import_file(path: Path, dry_run: bool = False) -> tuple[int, int, int]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        data = data.get("facilities") or data.get("rows") or data.get("data") or []
    if not isinstance(data, list):
        raise SystemExit("JSON must be an array of facility objects")

    db = SessionLocal()
    created = updated = skipped = 0
    try:
        for raw in data:
            fields = normalize_record(raw)
            if not fields:
                skipped += 1
                continue
            external_id = fields.pop("external_id", None)
            slug = fields["slug"]
            existing = None
            if external_id:
                existing = db.query(RehabCenter).filter(RehabCenter.external_id == external_id).first()
            if not existing:
                existing = db.query(RehabCenter).filter(RehabCenter.slug == slug).first()
            if existing:
                if dry_run:
                    updated += 1
                    continue
                for key, val in fields.items():
                    if key != "slug" and val is not None:
                        setattr(existing, key, val)
                if external_id:
                    existing.external_id = external_id
                existing.source = CenterSource.imported
                if existing.listing_status == ListingStatus.draft:
                    existing.listing_status = ListingStatus.published
                updated += 1
            else:
                if dry_run:
                    created += 1
                    continue
                slug_candidate = slug
                n = 1
                while db.query(RehabCenter).filter(RehabCenter.slug == slug_candidate).first():
                    n += 1
                    slug_candidate = f"{slug}-{n}"
                center = RehabCenter(
                    **fields,
                    slug=slug_candidate,
                    external_id=external_id,
                    source=CenterSource.imported,
                    listing_status=ListingStatus.published,
                    claimed=False,
                    contact_visible=False,
                )
                db.add(center)
                created += 1
        if not dry_run:
            db.commit()
    finally:
        db.close()
    return created, updated, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Import SAMHSA facilities into rehab_centers")
    parser.add_argument("json_path", type=Path, help="Path to facilities JSON file")
    parser.add_argument("--dry-run", action="store_true", help="Count changes without writing")
    args = parser.parse_args()
    if not args.json_path.is_file():
        raise SystemExit(f"File not found: {args.json_path}")
    created, updated, skipped = import_file(args.json_path, dry_run=args.dry_run)
    mode = " (dry run)" if args.dry_run else ""
    print(f"Import complete{mode}: created={created}, updated={updated}, skipped={skipped}")


if __name__ == "__main__":
    main()
