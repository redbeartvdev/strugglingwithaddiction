from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def run_migrations(engine: Engine) -> None:
    insp = inspect(engine)
    if "posts" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("posts")}
        with engine.begin() as conn:
            if "deleted_at" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMPTZ"))
            if "content_json" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN content_json TEXT"))
            if "visibility_password_hash" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN visibility_password_hash VARCHAR(255)"))
            if "meta_title" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN meta_title VARCHAR(255)"))
            if "meta_description" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN meta_description VARCHAR(512)"))
            if "focus_keyword" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN focus_keyword VARCHAR(100)"))
            if "seo_noindex" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN seo_noindex BOOLEAN NOT NULL DEFAULT FALSE"))
            # Add 'private' to poststatus enum if missing (Postgres)
            try:
                conn.execute(text("ALTER TYPE poststatus ADD VALUE IF NOT EXISTS 'private'"))
            except Exception:
                try:
                    conn.execute(text("ALTER TYPE poststatus ADD VALUE 'private'"))
                except Exception:
                    pass

    if "rehab_centers" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("rehab_centers")}
        with engine.begin() as conn:
            if "published_at" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN published_at TIMESTAMPTZ"))
            if "deleted_at" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN deleted_at TIMESTAMPTZ"))
            if "external_id" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN external_id VARCHAR(128)"))
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ix_rehab_centers_external_id "
                        "ON rehab_centers (external_id) WHERE external_id IS NOT NULL"
                    )
                )
            if "insurance_accepted" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN insurance_accepted VARCHAR[]"))
            if "treatment_levels" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN treatment_levels VARCHAR[]"))
            if "accreditations" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN accreditations VARCHAR[]"))
            if "gallery_keys" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN gallery_keys VARCHAR[]"))
            if "listing_tier" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN listing_tier VARCHAR(32) NOT NULL DEFAULT 'free'"))
            if "is_sponsored" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN is_sponsored BOOLEAN NOT NULL DEFAULT FALSE"))

    if "directory_pages" not in insp.get_table_names():
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE directory_pages (
                        id SERIAL PRIMARY KEY,
                        page_type VARCHAR(32) NOT NULL,
                        status VARCHAR(32) NOT NULL DEFAULT 'draft',
                        state_slug VARCHAR(100) NOT NULL,
                        city_slug VARCHAR(100),
                        title VARCHAR(500) NOT NULL,
                        body_html TEXT NOT NULL DEFAULT '',
                        faq_json JSONB DEFAULT '[]',
                        meta_title VARCHAR(255),
                        meta_description VARCHAR(512),
                        filter_state VARCHAR(100),
                        filter_city VARCHAR(100),
                        filter_insurance VARCHAR(100),
                        published_at TIMESTAMPTZ,
                        deleted_at TIMESTAMPTZ,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX ix_directory_pages_state_city "
                    "ON directory_pages (state_slug, COALESCE(city_slug, '')) "
                    "WHERE deleted_at IS NULL"
                )
            )

    if "scrape_jobs" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("scrape_jobs")}
        with engine.begin() as conn:
            if "state" not in cols:
                conn.execute(text("ALTER TABLE scrape_jobs ADD COLUMN state VARCHAR(100)"))
            if "results_json" not in cols:
                conn.execute(text("ALTER TABLE scrape_jobs ADD COLUMN results_json TEXT"))
