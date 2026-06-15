"""Serve Vite production bundles from /static when present (Railway monolith deploy)."""
from __future__ import annotations

import logging
import mimetypes
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

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
    return FileResponse(path, media_type=media_type or "application/octet-stream")


def register_static_site(app: FastAPI) -> None:
    index = STATIC_ROOT / "index.html"
    if not index.is_file():
        logger.info("No static/index.html — running API-only (use Railway monolith build for full site)")
        return

    admin_index = ADMIN_ROOT / "index.html"
    if not admin_index.is_file():
        logger.warning("static/index.html exists but static/admin/index.html missing — admin UI unavailable")

    @app.get("/", include_in_schema=False)
    async def site_root() -> FileResponse:
        return _file_response(index)

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
    async def public_spa(full_path: str) -> FileResponse:
        if full_path.startswith(("api/", "uploads/", "health")) or full_path == "health":
            raise HTTPException(status_code=404)
        if full_path == "admin" or full_path.startswith("admin/"):
            raise HTTPException(status_code=404)
        # /images is served by mount_image_assets; avoid SPA fallback for missing files there.
        if full_path.startswith("images/"):
            raise HTTPException(status_code=404)

        candidate = STATIC_ROOT / full_path
        if candidate.is_file():
            return _file_response(candidate)

        # Missing static files must 404 — returning index.html breaks script/img tags.
        if full_path.startswith(("assets/", "favicon")) or "." in Path(full_path).name:
            raise HTTPException(status_code=404)

        return _file_response(index)

    logger.info("Serving public site from %s and admin from %s", STATIC_ROOT, ADMIN_ROOT)
