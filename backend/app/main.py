from contextlib import asynccontextmanager
from pathlib import Path
import logging
import threading
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import RedirectResponse

from app.api import auth, blog, billing, client_portal, profiles, rehab, search, users, import_centers, claim_journey, leads_upsells, lifecycle, email_admin, email_list, insurance, analytics, center_submissions, geo, admin_overview, service_codes, sitemap
from app.api.sitemap import CANONICAL_HOST, WWW_HOST
from app.static_site import mount_image_assets, register_static_site
from app.bootstrap import bootstrap_admin, bootstrap_plans, bootstrap_stripe_settings, seed_rehab_centers, seed_insurance_catalog, activate_claimed_providers
from app.services.service_codes import seed_service_code_catalog
from app.seed_import import import_blog_if_empty, import_users_if_missing
from app.config import get_settings
from app.core.rate_limit import limiter
from app.db_migrate import run_migrations
from app.database import SessionLocal, engine
from app.models import Base

settings = get_settings()
logger = logging.getLogger("swa")


def _run_startup_tasks() -> None:
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    # Run each seed independently so one failure cannot skip the insurance catalog
    # (empty catalog breaks provider pickers and public search filters).
    tasks = (
        ("bootstrap_admin", bootstrap_admin),
        ("bootstrap_plans", bootstrap_plans),
        ("bootstrap_stripe_settings", bootstrap_stripe_settings),
        ("seed_rehab_centers", seed_rehab_centers),
        ("seed_insurance_catalog", seed_insurance_catalog),
        ("seed_service_code_catalog", seed_service_code_catalog),
        ("import_blog_if_empty", import_blog_if_empty),
        ("import_users_if_missing", import_users_if_missing),
        ("activate_claimed_providers", activate_claimed_providers),
    )
    for name, fn in tasks:
        db = SessionLocal()
        try:
            fn(db)
        except Exception:
            logger.exception("Startup task failed: %s", name)
        finally:
            db.close()


def _startup_worker() -> None:
    try:
        _run_startup_tasks()
        logger.info("Startup tasks completed")
    except Exception:
        logger.exception(
            "Startup tasks failed — API is still listening. "
            "Check DATABASE_URL is linked to Postgres on Railway."
        )


def _lifecycle_worker() -> None:
    """Run idempotent lifecycle email tasks every six hours."""
    time.sleep(20)  # allow database bootstrap to complete first
    while True:
        db = SessionLocal()
        try:
            lifecycle.run_lifecycle_jobs(db)
        except Exception:
            logger.exception("Lifecycle job failed")
        finally:
            db.close()
        time.sleep(6 * 60 * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run DB bootstrap in the background so uvicorn binds to $PORT before Railway health checks.
    threading.Thread(target=_startup_worker, daemon=True, name="swa-startup").start()
    threading.Thread(target=_lifecycle_worker, daemon=True, name="swa-lifecycle").start()
    yield


app = FastAPI(title="SWA API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class CanonicalHostMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        host = (request.headers.get("host") or "").split(":")[0].lower()
        if host == WWW_HOST:
            target = request.url.replace(scheme="https", netloc=CANONICAL_HOST)
            return RedirectResponse(str(target), status_code=301)
        return await call_next(request)


class StaticCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        if path.startswith("/assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif path.startswith("/images/") or path.startswith("/fonts/") or path.endswith((".woff2", ".woff")):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


# Dev: allow any localhost port (Vite may use 5173–5176). Prod: explicit CORS_ORIGINS only.
_cors_origins = list(settings.cors_origin_list)
if settings.is_production:
    for origin in (f"https://{CANONICAL_HOST}", f"https://{WWW_HOST}"):
        if origin not in _cors_origins:
            _cors_origins.append(origin)

_cors_kwargs: dict = {
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
    "allow_origins": _cors_origins,
}
if not settings.is_production:
    _cors_kwargs["allow_origin_regex"] = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"

app.add_middleware(CORSMiddleware, **_cors_kwargs)
app.add_middleware(CanonicalHostMiddleware)
app.add_middleware(StaticCacheMiddleware)

upload_path = Path(settings.upload_dir)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

app.include_router(auth.router)
app.include_router(profiles.router)
app.include_router(users.router)
app.include_router(blog.router)
app.include_router(rehab.router)
app.include_router(import_centers.router)
app.include_router(claim_journey.router)
app.include_router(leads_upsells.router)
app.include_router(billing.router)
app.include_router(client_portal.router)
app.include_router(search.router)
app.include_router(lifecycle.router)
app.include_router(email_admin.router)
app.include_router(email_list.router)
app.include_router(insurance.router)
app.include_router(service_codes.router)
app.include_router(analytics.router)
app.include_router(admin_overview.router)
app.include_router(center_submissions.router)
app.include_router(geo.router)
app.include_router(sitemap.router)


@app.get("/health")
def health():
    db_ok = False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass
    payload: dict = {"status": "ok", "database": "connected" if db_ok else "unavailable"}
    if not db_ok and settings.uses_local_database:
        payload["hint"] = (
            "DATABASE_URL is not linked to Railway Postgres. "
            "Add PostgreSQL in Railway and reference ${{Postgres.DATABASE_URL}} on this service."
        )
    return payload


mount_image_assets(app)
register_static_site(app)
