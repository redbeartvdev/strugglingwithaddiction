"""Serve Vite production bundles from /static when present (Railway monolith deploy)."""
from __future__ import annotations

import logging
import mimetypes
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.api.sitemap import canonical_base_url
from app.database import SessionLocal
from app.seo.document import inject
from app.seo.pages import (
    insurance_legacy_redirect,
    legacy_center_redirect,
    not_found_page,
    resolve_public_page,
)
from app.seo.redirects import lookup_redirect

logger = logging.getLogger("swa")

BACKEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_ROOT.parent
STATIC_ROOT = BACKEND_ROOT / "static"
ADMIN_ROOT = STATIC_ROOT / "admin"


def resolve_images_dir() -> Path | None:
    """Blog/media assets shipped in public/images (copied to static/images in deploy)."""
    for candidate in (
        STATIC_ROOT / "images",
        REPO_ROOT / "public" / "images",
        BACKEND_ROOT / "image-assets",
    ):
        if candidate.is_dir():
            return candidate
    return None


def mount_image_assets(app: FastAPI) -> None:
    images_dir = resolve_images_dir()
    if not images_dir:
        logger.warning("No images directory found — blog featured images may 404")
        return
    app.mount("/images", StaticFiles(directory=str(images_dir)), name="images")
    logger.info("Serving image assets from %s", images_dir)


def _file_response(path: Path) -> FileResponse:
    media_type, _ = mimetypes.guess_type(path.name)
    headers = {}
    relative = path.as_posix()
    if "/assets/" in relative or path.parent.name == "assets":
        headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif path.suffix.lower() in {".woff2", ".woff"}:
        headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif path.suffix.lower() in {".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico"}:
        headers["Cache-Control"] = "public, max-age=2592000"
    return FileResponse(
        path,
        media_type=media_type or "application/octet-stream",
        headers=headers,
    )


def _normalize_public_path(full_path: str) -> str:
    path = f"/{full_path}" if full_path else "/"
    if path != "/" and "//" in path:
        path = re_collapse(path)
    return path


def re_collapse(path: str) -> str:
    while "//" in path:
        path = path.replace("//", "/")
    return path or "/"


def _render_seo_html(path: str, index: Path) -> HTMLResponse | RedirectResponse:
    mapped = lookup_redirect(path)
    if mapped:
        dest, status = mapped
        return RedirectResponse(dest, status_code=status)

    if len(path) > 1 and path.endswith("/"):
        return RedirectResponse(path.rstrip("/") or "/", status_code=301)

    insurance = insurance_legacy_redirect(path)
    if insurance:
        return RedirectResponse(insurance, status_code=301)

    shell = index.read_text(encoding="utf-8")
    base = canonical_base_url()
    db = SessionLocal()
    try:
        legacy = legacy_center_redirect(db, path)
        if legacy:
            return RedirectResponse(legacy, status_code=301)
        page = resolve_public_page(path, db, base)
        if page is None:
            page = not_found_page(path, base)
        html = inject(shell, page, base)
        return HTMLResponse(html, status_code=page.status)
    except Exception:
        logger.exception("SEO HTML render failed for %s", path)
        return _file_response(index)
    finally:
        db.close()


def register_static_site(app: FastAPI) -> None:
    index = STATIC_ROOT / "index.html"
    if not index.is_file():
        logger.info("No static/index.html — running API-only (use Railway monolith build for full site)")
        return

    admin_index = ADMIN_ROOT / "index.html"
    if not admin_index.is_file():
        logger.warning("static/index.html exists but static/admin/index.html missing — admin UI unavailable")

    @app.get("/", include_in_schema=False)
    async def site_root():
        return _render_seo_html("/", index)

    @app.get("/admin", include_in_schema=False)
    @app.get("/admin/", include_in_schema=False)
    async def admin_root() -> FileResponse:
        if not admin_index.is_file():
            raise HTTPException(status_code=404, detail="Admin UI not built")
        return _file_response(admin_index)

    @app.get("/admin/{full_path:path}", include_in_schema=False)
    async def admin_spa(full_path: str) -> FileResponse:
        if not admin_index.is_file():
            raise HTTPException(status_code=404, detail="Admin UI not built")
        if full_path.startswith("api"):
            raise HTTPException(status_code=404)
        candidate = ADMIN_ROOT / full_path
        if candidate.is_file():
            return _file_response(candidate)
        return _file_response(admin_index)

    @app.get("/{full_path:path}", include_in_schema=False)
    async def public_spa(full_path: str):
        if full_path.startswith(("api/", "uploads/", "health")) or full_path == "health":
            raise HTTPException(status_code=404)
        if full_path == "admin" or full_path.startswith("admin/"):
            raise HTTPException(status_code=404)
        if full_path.startswith("images/"):
            raise HTTPException(status_code=404)

        candidate = STATIC_ROOT / full_path
        if candidate.is_file():
            return _file_response(candidate)

        if full_path.startswith(("assets/", "favicon")) or "." in Path(full_path).name:
            raise HTTPException(status_code=404)

        path = _normalize_public_path(full_path)
        return _render_seo_html(path, index)

    logger.info("Serving public site from %s and admin from %s", STATIC_ROOT, ADMIN_ROOT)
