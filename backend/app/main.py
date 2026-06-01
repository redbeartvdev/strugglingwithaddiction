from contextlib import asynccontextmanager
from pathlib import Path
import logging
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import text

from app.api import auth, blog, billing, client_portal, profiles, rehab, search, users
from app.static_site import register_static_site
from app.bootstrap import bootstrap_admin, bootstrap_plans, seed_rehab_centers
from app.seed_import import import_blog_if_empty, import_users_if_missing
from app.config import get_settings
from app.db_migrate import run_migrations
from app.database import SessionLocal, engine
from app.models import Base

settings = get_settings()
limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger("swa")


def _run_startup_tasks() -> None:
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    db = SessionLocal()
    try:
        bootstrap_admin(db)
        bootstrap_plans(db)
        seed_rehab_centers(db)
        import_blog_if_empty(db)
        import_users_if_missing(db)
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run DB bootstrap in the background so uvicorn binds to $PORT before Railway health checks.
    threading.Thread(target=_startup_worker, daemon=True, name="swa-startup").start()
    yield


app = FastAPI(title="SWA API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Dev: allow any localhost port (Vite may use 5173–5176). Prod: explicit CORS_ORIGINS only.
_cors_kwargs: dict = {
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if settings.is_production:
    _cors_kwargs["allow_origins"] = settings.cors_origin_list
else:
    _cors_kwargs["allow_origins"] = settings.cors_origin_list
    _cors_kwargs["allow_origin_regex"] = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"

app.add_middleware(CORSMiddleware, **_cors_kwargs)

upload_path = Path(settings.upload_dir)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

app.include_router(auth.router)
app.include_router(profiles.router)
app.include_router(users.router)
app.include_router(blog.router)
app.include_router(rehab.router)
app.include_router(billing.router)
app.include_router(client_portal.router)
app.include_router(search.router)


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


register_static_site(app)
