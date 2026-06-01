from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api import auth, blog, billing, client_portal, profiles, rehab, search, users
from app.bootstrap import bootstrap_admin, bootstrap_plans, seed_rehab_centers
from app.config import get_settings
from app.db_migrate import run_migrations
from app.database import SessionLocal, engine
from app.models import Base

settings = get_settings()
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    db = SessionLocal()
    try:
        bootstrap_admin(db)
        bootstrap_plans(db)
        seed_rehab_centers(db)
    finally:
        db.close()
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
    return {"status": "ok"}
