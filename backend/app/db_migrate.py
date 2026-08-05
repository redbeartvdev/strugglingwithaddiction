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
            for col, ddl in [
                ("contact_email", "VARCHAR(255)"),
                ("outreach_email", "VARCHAR(255)"),
                ("outreach_unsubscribed_at", "TIMESTAMPTZ"),
                ("samhsa_id", "VARCHAR(64)"),
                ("google_maps_url", "VARCHAR(512)"),
                ("google_reviews_url", "VARCHAR(512)"),
                ("video_url", "VARCHAR(512)"),
                ("verification_url", "VARCHAR(512)"),
            ]:
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE rehab_centers ADD COLUMN {col} {ddl}"))
            if "gallery_keys" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN gallery_keys JSONB DEFAULT '[]'::jsonb"))
            if "testimonials" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN testimonials JSONB DEFAULT '[]'::jsonb"))
            for col in ("insurances", "levels_of_care", "amenities", "accreditations"):
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE rehab_centers ADD COLUMN {col} VARCHAR[] DEFAULT '{{}}'"))
            if "cert_verified_at" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN cert_verified_at TIMESTAMPTZ"))
            if "verified_badge" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN verified_badge BOOLEAN NOT NULL DEFAULT FALSE"))
            if "featured_until" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN featured_until TIMESTAMPTZ"))
            try:
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_rehab_centers_samhsa_id ON rehab_centers (samhsa_id)"))
            except Exception:
                pass

    # Ensure analytics / insurance tables exist even if create_all raced
    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS insurance_catalog (
                id SERIAL PRIMARY KEY,
                name VARCHAR(120) NOT NULL UNIQUE,
                slug VARCHAR(120) NOT NULL UNIQUE,
                logo_path VARCHAR(512) NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        ))
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS center_page_views (
                id SERIAL PRIMARY KEY,
                rehab_center_id INTEGER NOT NULL REFERENCES rehab_centers(id) ON DELETE CASCADE,
                visited_at TIMESTAMPTZ DEFAULT NOW(),
                visitor_state VARCHAR(64),
                device_type VARCHAR(32) NOT NULL DEFAULT 'desktop',
                path VARCHAR(512),
                referrer VARCHAR(512),
                session_key VARCHAR(64)
            )
            """
        ))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_center_page_views_center ON center_page_views (rehab_center_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_center_page_views_visited ON center_page_views (visited_at)"))

    # Coverage-hub editorial columns on insurance_catalog
    insp = inspect(engine)
    if "insurance_catalog" in insp.get_table_names():
        ins_cols = {c["name"] for c in insp.get_columns("insurance_catalog")}
        with engine.begin() as conn:
            for col, ddl in [
                ("meta_title", "VARCHAR(255)"),
                ("meta_description", "VARCHAR(512)"),
                ("hero_title", "VARCHAR(255)"),
                ("summary", "VARCHAR(512)"),
                ("content_html", "TEXT"),
                ("show_on_hub", "BOOLEAN NOT NULL DEFAULT FALSE"),
            ]:
                if col not in ins_cols:
                    conn.execute(text(f"ALTER TABLE insurance_catalog ADD COLUMN {col} {ddl}"))

    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS site_page_views (
                id SERIAL PRIMARY KEY,
                visited_at TIMESTAMPTZ DEFAULT NOW(),
                path VARCHAR(512) NOT NULL,
                page_title VARCHAR(255),
                referrer VARCHAR(512),
                visitor_state VARCHAR(64),
                device_type VARCHAR(32) NOT NULL DEFAULT 'desktop',
                session_key VARCHAR(64)
            )
            """
        ))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_site_page_views_visited ON site_page_views (visited_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_site_page_views_path ON site_page_views (path)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_site_page_views_session ON site_page_views (session_key)"))

    if "user_profiles" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("user_profiles")}
        if "notification_preferences" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE user_profiles ADD COLUMN notification_preferences JSONB DEFAULT '{}'::jsonb"))

    if "rehab_center_claims" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("rehab_center_claims")}
        with engine.begin() as conn:
            for col, ddl in [
                ("email_domain_matched", "BOOLEAN NOT NULL DEFAULT FALSE"),
                ("phone_verified_at", "TIMESTAMPTZ"),
                ("phone_otp_hash", "VARCHAR(255)"),
                ("phone_otp_expires_at", "TIMESTAMPTZ"),
                ("cert_verified_at", "TIMESTAMPTZ"),
                ("payment_received_at", "TIMESTAMPTZ"),
                ("reminder_sent_at", "TIMESTAMPTZ"),
                ("abandon_reminders_sent", "INTEGER NOT NULL DEFAULT 0"),
                ("abandon_lead_created_at", "TIMESTAMPTZ"),
            ]:
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE rehab_center_claims ADD COLUMN {col} {ddl}"))
            # One legacy reminder counts as day-1 already sent
            conn.execute(text(
                """
                UPDATE rehab_center_claims
                SET abandon_reminders_sent = 1
                WHERE reminder_sent_at IS NOT NULL
                  AND (abandon_reminders_sent IS NULL OR abandon_reminders_sent = 0)
                """
            ))
            for value in ("under_review", "certified", "abandoned"):
                try:
                    conn.execute(text(f"ALTER TYPE claimstatus ADD VALUE IF NOT EXISTS '{value}'"))
                except Exception:
                    try:
                        conn.execute(text(f"ALTER TYPE claimstatus ADD VALUE '{value}'"))
                    except Exception:
                        pass

    # Public “submit your center” queue
    with engine.begin() as conn:
        conn.execute(text(
            """
            DO $$ BEGIN
                CREATE TYPE centersubmissionstatus AS ENUM ('pending', 'approved', 'rejected');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
            """
        ))
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS center_submissions (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL DEFAULT '',
                center_name VARCHAR(255) NOT NULL DEFAULT '',
                email VARCHAR(255) NOT NULL DEFAULT '',
                phone VARCHAR(50) NOT NULL DEFAULT '',
                address_line VARCHAR(255) NOT NULL DEFAULT '',
                city VARCHAR(100) NOT NULL DEFAULT '',
                state VARCHAR(100) NOT NULL DEFAULT '',
                zip VARCHAR(20),
                services VARCHAR[] DEFAULT '{}',
                insurances VARCHAR[] DEFAULT '{}',
                description TEXT NOT NULL DEFAULT '',
                status centersubmissionstatus NOT NULL DEFAULT 'pending',
                admin_notes TEXT,
                reviewed_at TIMESTAMPTZ,
                reviewed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                rehab_center_id INTEGER REFERENCES rehab_centers(id) ON DELETE SET NULL,
                resume_token VARCHAR(64),
                reminder_sent_at TIMESTAMPTZ,
                abandon_reminders_sent INTEGER NOT NULL DEFAULT 0,
                abandon_lead_created_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        ))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_center_submissions_center_name ON center_submissions (center_name)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_center_submissions_email ON center_submissions (email)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_center_submissions_status ON center_submissions (status)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_center_submissions_rehab_center_id ON center_submissions (rehab_center_id)"))

    # Refresh inspector after possible table create
    insp = inspect(engine)
    if "center_submissions" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("center_submissions")}
        with engine.begin() as conn:
            for col, ddl in [
                ("resume_token", "VARCHAR(64)"),
                ("reminder_sent_at", "TIMESTAMPTZ"),
                ("abandon_reminders_sent", "INTEGER NOT NULL DEFAULT 0"),
                ("abandon_lead_created_at", "TIMESTAMPTZ"),
            ]:
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE center_submissions ADD COLUMN {col} {ddl}"))
            for value in ("draft", "abandoned"):
                try:
                    conn.execute(text(f"ALTER TYPE centersubmissionstatus ADD VALUE IF NOT EXISTS '{value}'"))
                except Exception:
                    try:
                        conn.execute(text(f"ALTER TYPE centersubmissionstatus ADD VALUE '{value}'"))
                    except Exception:
                        pass
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_center_submissions_resume_token ON center_submissions (resume_token)"))

    if "center_leads" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("center_leads")}
        with engine.begin() as conn:
            for col, ddl in [
                ("source_kind", "VARCHAR(64) NOT NULL DEFAULT 'inquiry'"),
                ("tag", "VARCHAR(64)"),
                ("center_name", "VARCHAR(255)"),
            ]:
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE center_leads ADD COLUMN {col} {ddl}"))
            # Abandonment leads for unfinished submit drafts may not have a center row yet
            try:
                conn.execute(text("ALTER TABLE center_leads ALTER COLUMN rehab_center_id DROP NOT NULL"))
            except Exception:
                pass
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_center_leads_source_kind ON center_leads (source_kind)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_center_leads_tag ON center_leads (tag)"))

    # Stripe settings singleton + local invoice mirror
    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS platform_stripe_settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                secret_key TEXT,
                webhook_secret TEXT,
                publishable_key VARCHAR(255),
                price_monthly VARCHAR(255),
                price_yearly VARCHAR(255),
                price_verified_badge VARCHAR(255),
                price_featured_placement VARCHAR(255),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        ))
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS billing_invoices (
                id SERIAL PRIMARY KEY,
                stripe_invoice_id VARCHAR(255) NOT NULL UNIQUE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                rehab_center_id INTEGER REFERENCES rehab_centers(id) ON DELETE SET NULL,
                number VARCHAR(64),
                status VARCHAR(50) NOT NULL DEFAULT 'open',
                amount_due INTEGER NOT NULL DEFAULT 0,
                amount_paid INTEGER NOT NULL DEFAULT 0,
                currency VARCHAR(16) NOT NULL DEFAULT 'usd',
                interval VARCHAR(16),
                period_start TIMESTAMPTZ,
                period_end TIMESTAMPTZ,
                hosted_invoice_url VARCHAR(1024),
                invoice_pdf VARCHAR(1024),
                paid_at TIMESTAMPTZ,
                source VARCHAR(32) NOT NULL DEFAULT 'subscription',
                product_label VARCHAR(255),
                description TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        ))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_invoices_stripe_id ON billing_invoices (stripe_invoice_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_invoices_user ON billing_invoices (user_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_invoices_center ON billing_invoices (rehab_center_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_invoices_status ON billing_invoices (status)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_billing_invoices_paid_at ON billing_invoices (paid_at)"))
