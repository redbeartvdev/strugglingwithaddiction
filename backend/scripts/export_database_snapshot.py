#!/usr/bin/env python3
"""Export a sanitized local-dev database snapshot for sharing via GitHub.

Reads DATABASE_URL (defaults to backend/.env) and writes JSON tables under
backend/seed-data/database-snapshot/.

Secrets (API keys, SMTP passwords, Stripe IDs, OTP hashes) are cleared so the
snapshot is safe to commit. Password hashes are kept so existing local logins
still work after import.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from urllib.parse import unquote, urlparse

import psycopg2
import psycopg2.extras

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
OUT_DIR = BACKEND / "seed-data" / "database-snapshot"

# Order matters for docs; import truncates CASCADE then loads in this order.
TABLES = [
    "users",
    "user_profiles",
    "authors",
    "categories",
    "posts",
    "post_categories",
    "blog_settings",
    "rehab_centers",
    "insurance_catalog",
    "service_code_catalog",
    "subscription_plans",
    "subscriptions",
    "client_landing_pages",
    "platform_email_settings",
]

# Columns wiped before writing (never commit live secrets).
REDACT = {
    "platform_email_settings": {"resend_api_key", "smtp_password", "smtp_host", "smtp_username", "mailchimp_api_key"},
    "subscription_plans": {"stripe_price_id_monthly", "stripe_price_id_yearly"},
    "subscriptions": {"stripe_customer_id", "stripe_subscription_id"},
    "rehab_center_claims": {"phone_otp_hash", "phone_otp_expires_at"},
}


def load_database_url() -> str:
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"].strip()
    env_path = BACKEND / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DATABASE_URL not set and backend/.env missing DATABASE_URL")


def json_default(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, memoryview):
        return bytes(value).hex()
    if isinstance(value, bytes):
        return value.hex()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def connect(url: str):
    u = urlparse(url)
    return psycopg2.connect(
        host=u.hostname,
        port=u.port or 5432,
        user=u.username,
        password=unquote(u.password or ""),
        dbname=(u.path or "").lstrip("/"),
    )


def redact_row(table: str, row: dict) -> dict:
    wipe = REDACT.get(table, set())
    return {key: (None if key in wipe else val) for key, val in row.items()}


def main() -> None:
    url = load_database_url()
    u = urlparse(url)
    print(f"Exporting from {u.hostname}:{u.port}{u.path}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = {
        "format": "swa-database-snapshot-v1",
        "exported_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "tables": [],
        "notes": [
            "Sanitized for local development sharing.",
            "API keys, SMTP passwords, and Stripe IDs were cleared.",
            "Password hashes are preserved for local login.",
            "Load with: ./scripts/load-local-database.sh",
        ],
    }

    with connect(url) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public'")
            existing = {r["tablename"] for r in cur.fetchall()}
            for table in TABLES:
                if table not in existing:
                    print(f"  skip missing table: {table}")
                    continue
                cur.execute(f'SELECT * FROM "{table}" ORDER BY 1')
                rows = [redact_row(table, dict(r)) for r in cur.fetchall()]
                path = OUT_DIR / f"{table}.json"
                path.write_text(json.dumps(rows, indent=2, default=json_default) + "\n")
                manifest["tables"].append({"name": table, "rows": len(rows), "file": path.name})
                print(f"  {table}: {len(rows)} rows → {path.relative_to(ROOT)}")

    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (OUT_DIR / "README.md").write_text(
        "# Shared local database snapshot\n\n"
        "Sanitized copy of the SWA Postgres data for local development.\n\n"
        "## Load on your machine\n\n"
        "```bash\n"
        "./scripts/load-local-database.sh\n"
        "```\n\n"
        "Or manually:\n\n"
        "```bash\n"
        "docker compose up -d postgres\n"
        "cd backend && source .venv/bin/activate\n"
        "export DATABASE_URL=postgresql://swa:swa_dev_password@localhost:5433/swa\n"
        "python scripts/import_database_snapshot.py\n"
        "```\n\n"
        "Stripe IDs and email provider secrets are cleared. Password hashes are kept.\n"
    )
    print(f"Wrote {OUT_DIR.relative_to(ROOT)}/manifest.json")
    print("Done.")


if __name__ == "__main__":
    main()
