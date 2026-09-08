"""SAMHSA service-code catalog: CSV seed, grouping, and listing resolution."""
from __future__ import annotations

import csv
import logging
import re
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.service_code import ServiceCodeCatalog
from app.schemas.service_code import ServiceCodeOut, ServiceCodePublic

logger = logging.getLogger("swa")

CSV_PATH = Path(__file__).resolve().parents[1] / "data" / "service-code-references.csv"

# Directory filter IDs → catalog service codes that should match a listing.
SERVICE_CODE_FILTER_MAP: dict[str, list[str]] = {
    "inpatient": ["HI", "RES", "RTCA", "RTCC", "ORES", "IPSY"],
    "outpatient": ["OP", "OMH"],
    "php": ["PHP", "PH"],
    "dual-diagnosis": ["SUMH", "IDD", "MHSU"],
    "mental-health": ["MH"],
    "trauma": ["TRMA", "PTSD"],
    "telehealth": ["TELE"],
    "family": ["CFT", "FPSY"],
    "eating-disorders": ["PED"],
    "substance-use": ["SA"],
    "mat": ["NRT", "NSC"],
}


def _clean(value: str | None) -> str:
    return " ".join(str(value or "").replace("\xa0", " ").split()).strip()


def load_reference_rows(path: Path | None = None) -> list[dict[str, str]]:
    csv_path = path or CSV_PATH
    if not csv_path.exists():
        raise FileNotFoundError(f"Service code CSV not found: {csv_path}")
    rows: list[dict[str, str]] = []
    with csv_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for raw in reader:
            category_code = _clean(raw.get("category_code")).upper()
            service_code = _clean(raw.get("service_code"))
            service_name = _clean(raw.get("service_name"))
            if not category_code or not service_code or not service_name:
                continue
            rows.append(
                {
                    "category_code": category_code,
                    "category_name": _clean(raw.get("category_name")),
                    "service_code": service_code,
                    "service_name": service_name,
                    "service_description": _clean(raw.get("service_description")),
                }
            )
    return rows


def seed_service_code_catalog(db: Session) -> dict[str, int]:
    """Idempotent seed from the reference CSV. Admin edits to name/description survive reseed."""
    references = load_reference_rows()
    existing = {row.service_code: row for row in db.query(ServiceCodeCatalog).all()}
    created = 0
    updated = 0
    for index, item in enumerate(references):
        row = existing.get(item["service_code"])
        if row:
            row.category_code = item["category_code"]
            row.category_name = item["category_name"]
            row.sort_order = index
            if not (row.service_name or "").strip():
                row.service_name = item["service_name"]
            if not (row.service_description or "").strip() and item["service_description"]:
                row.service_description = item["service_description"]
            updated += 1
            continue
        db.add(
            ServiceCodeCatalog(
                category_code=item["category_code"],
                category_name=item["category_name"],
                service_code=item["service_code"],
                service_name=item["service_name"],
                service_description=item["service_description"],
                enabled=True,
                sort_order=index,
            )
        )
        created += 1
    db.commit()
    total = db.query(ServiceCodeCatalog).count()
    logger.info("Service code catalog seed: created=%s updated=%s total=%s", created, updated, total)
    return {"created": created, "updated": updated, "total": total}


# SAMHSA locator `service_code_info` uses * between category groups and spaces between codes.
_SERVICE_INFO_SPLIT = re.compile(r"[\s|;,]+")

# PAY codes that map onto the USA insurance catalog used by listings.
PAY_TO_INSURANCE: dict[str, str] = {
    "MC": "Medicare",
    "MD": "Medicaid",
    "TRICARE": "Tricare",
}


def catalog_lookup(db: Session) -> dict[str, ServiceCodeCatalog]:
    """Uppercased service_code → catalog row."""
    return {row.service_code.upper(): row for row in db.query(ServiceCodeCatalog).all()}


def parse_service_code_info(raw: str | None) -> list[str]:
    """Extract tokens from SAMHSA `service_code_info` or a pipe-separated list."""
    if raw is None:
        return []
    text = str(raw).replace("\xa0", " ").strip()
    if not text:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for group in re.split(r"\*+", text):
        for token in _SERVICE_INFO_SPLIT.split(group.strip()):
            code = token.strip().strip(".,")
            if not code:
                continue
            key = code.upper()
            if key in seen:
                continue
            seen.add(key)
            out.append(code)
    return out


def resolve_imported_service_codes(
    raw: str | None,
    lookup: dict[str, ServiceCodeCatalog],
) -> list[ServiceCodeCatalog]:
    """Keep only tokens that exist in the catalog, in file order."""
    rows: list[ServiceCodeCatalog] = []
    seen: set[str] = set()
    for token in parse_service_code_info(raw):
        row = lookup.get(token.upper())
        if not row or row.service_code in seen:
            continue
        seen.add(row.service_code)
        rows.append(row)
    return rows


def derive_listing_fields(rows: list[ServiceCodeCatalog]) -> dict[str, list[str]]:
    """Fill public listing lists from known codes when the spreadsheet left those columns empty."""
    specialties: list[str] = []
    levels: list[str] = []
    insurances: list[str] = []
    seen_spec: set[str] = set()
    seen_level: set[str] = set()
    seen_ins: set[str] = set()
    for row in rows:
        name = (row.service_name or "").strip()
        if row.category_code == "TC" and name and name not in seen_spec:
            seen_spec.add(name)
            specialties.append(name)
        elif row.category_code == "SET" and name and name not in seen_level:
            seen_level.add(name)
            levels.append(name)
        insurance = PAY_TO_INSURANCE.get(row.service_code.upper())
        if insurance and insurance not in seen_ins:
            seen_ins.add(insurance)
            insurances.append(insurance)
    return {
        "specialties": specialties,
        "levels_of_care": levels,
        "insurances": insurances,
    }


def known_catalog_codes(db: Session) -> set[str]:
    return {row.service_code for row in db.query(ServiceCodeCatalog.service_code).all()}


def sanitize_center_service_codes(db: Session, codes: list[str] | None) -> list[str]:
    allowed = known_catalog_codes(db)
    return [code for code in normalize_service_codes(codes) if code in allowed]


def normalize_service_codes(codes: list[str] | None) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in codes or []:
        code = _clean(raw)
        if not code or code in seen:
            continue
        seen.add(code)
        out.append(code)
    return out


def resolve_service_details(db: Session, codes: list[str] | None) -> list[ServiceCodePublic]:
    wanted = normalize_service_codes(codes)
    if not wanted:
        return []
    rows = (
        db.query(ServiceCodeCatalog)
        .filter(ServiceCodeCatalog.service_code.in_(wanted), ServiceCodeCatalog.enabled.is_(True))
        .order_by(ServiceCodeCatalog.sort_order.asc(), ServiceCodeCatalog.service_name.asc())
        .all()
    )
    by_code = {row.service_code: row for row in rows}
    details: list[ServiceCodePublic] = []
    for code in wanted:
        row = by_code.get(code)
        if not row:
            continue
        details.append(
            ServiceCodePublic(
                category_code=row.category_code,
                category_name=row.category_name,
                service_code=row.service_code,
                service_name=row.service_name,
                service_description=row.service_description or "",
            )
        )
    return details


def catalog_to_out(row: ServiceCodeCatalog) -> ServiceCodeOut:
    return ServiceCodeOut.model_validate(row)


def group_catalog(rows: list[ServiceCodeCatalog]) -> list[dict]:
    groups: dict[str, dict] = {}
    order: list[str] = []
    for row in rows:
        key = row.category_code
        if key not in groups:
            groups[key] = {
                "category_code": row.category_code,
                "category_name": row.category_name,
                "codes": [],
            }
            order.append(key)
        groups[key]["codes"].append(catalog_to_out(row))
    return [groups[key] for key in order]


def center_codes_match_filter(codes: list[str] | None, service_id: str | None) -> bool:
    if not service_id:
        return True
    mapped = SERVICE_CODE_FILTER_MAP.get(service_id.strip().lower())
    if not mapped:
        return False
    have = {code.upper() for code in (codes or [])}
    return any(code.upper() in have for code in mapped)
