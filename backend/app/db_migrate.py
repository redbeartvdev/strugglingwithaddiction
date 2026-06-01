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

    if "scrape_jobs" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("scrape_jobs")}
        with engine.begin() as conn:
            if "state" not in cols:
                conn.execute(text("ALTER TABLE scrape_jobs ADD COLUMN state VARCHAR(100)"))
            if "results_json" not in cols:
                conn.execute(text("ALTER TABLE scrape_jobs ADD COLUMN results_json TEXT"))
