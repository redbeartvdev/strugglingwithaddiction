#!/usr/bin/env python3
"""Import backend/seed-data/database-snapshot into DATABASE_URL.

Creates schema/migrations first, then replaces snapshot tables with the shared
dev data. Safe for local Docker Postgres (see scripts/load-local-database.sh).
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from sqlalchemy import MetaData, Table, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.bootstrap import (
    bootstrap_admin,
    bootstrap_plans,
    seed_insurance_catalog,
    seed_rehab_centers,
    seed_upsell_products,
)
from app.database import SessionLocal, engine
from app.db_migrate import run_migrations
from app.models import Base  # noqa: F401
from app.seed_import import import_blog_if_empty, import_users_if_missing

SNAPSHOT_DIR = BACKEND / "seed-data" / "database-snapshot"


def parse_dt(value):
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return value


def coerce_row(table: Table, row: dict) -> dict:
    out = {}
    for col in table.columns:
        if col.name not in row:
            continue
        val = row[col.name]
        type_name = type(col.type).__name__.lower()
        if val is not None and ("datetime" in type_name or "timestamp" in type_name):
            val = parse_dt(val)
        out[col.name] = val
    return out


def load_table_rows(name: str) -> list[dict]:
    path = SNAPSHOT_DIR / f"{name}.json"
    if not path.exists():
        return []
    return json.loads(path.read_text())


def main() -> None:
    if not (SNAPSHOT_DIR / "manifest.json").exists():
        raise SystemExit(f"Missing snapshot at {SNAPSHOT_DIR}. Run export_database_snapshot.py first.")

    manifest = json.loads((SNAPSHOT_DIR / "manifest.json").read_text())
    tables = [t["name"] for t in manifest.get("tables", [])]
    if not tables:
        raise SystemExit("Snapshot manifest has no tables.")

    print(f"Target: {engine.url.render_as_string(hide_password=True)}")
    print(f"Snapshot: {SNAPSHOT_DIR} ({manifest.get('exported_at', 'unknown')})")

    Base.metadata.create_all(bind=engine)
    run_migrations(engine)

    meta = MetaData()
    meta.reflect(bind=engine)

    # Wipe snapshot tables (dependents first via CASCADE).
    with engine.begin() as conn:
        quoted = ", ".join(f'"{t}"' for t in reversed(tables) if t in meta.tables)
        if quoted:
            conn.execute(text(f"TRUNCATE {quoted} RESTART IDENTITY CASCADE"))
            print(f"Truncated: {', '.join(reversed([t for t in reversed(tables) if t in meta.tables]))}")

    with engine.begin() as conn:
        for name in tables:
            if name not in meta.tables:
                print(f"  skip unknown table: {name}")
                continue
            table = meta.tables[name]
            rows = [coerce_row(table, r) for r in load_table_rows(name)]
            if not rows:
                print(f"  {name}: 0 rows")
                continue
            # Insert in chunks for large tables (posts).
            chunk = 100
            for i in range(0, len(rows), chunk):
                conn.execute(pg_insert(table), rows[i : i + chunk])
            print(f"  {name}: {len(rows)} rows")

            # Fix serial sequences when a single integer PK was imported explicitly.
            pk_cols = list(table.primary_key.columns)
            if len(pk_cols) == 1:
                pk = pk_cols[0].name
                conn.execute(
                    text(
                        f"""
                        SELECT CASE
                          WHEN pg_get_serial_sequence('"{name}"', '{pk}') IS NULL THEN NULL
                          ELSE setval(
                            pg_get_serial_sequence('"{name}"', '{pk}'),
                            COALESCE((SELECT MAX("{pk}") FROM "{name}"), 1),
                            true
                          )
                        END
                        """
                    )
                )

    # Fill anything the snapshot omitted (safe no-ops when data already present).
    db = SessionLocal()
    try:
        bootstrap_admin(db)
        bootstrap_plans(db)
        seed_rehab_centers(db)
        seed_insurance_catalog(db)
        seed_upsell_products(db)
        import_blog_if_empty(db)
        import_users_if_missing(db)
    finally:
        db.close()

    print("Done. Local database is loaded from the shared snapshot.")


if __name__ == "__main__":
    main()
