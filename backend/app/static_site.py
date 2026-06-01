"""Serve Vite production bundles from /static when present (Railway monolith deploy)."""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

logger = logging.getLogger("swa")

STATIC_ROOT = Path(__file__).resolve().parent.parent / "static"
ADMIN_ROOT = STATIC_ROOT / "admin"


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
        return FileResponse(index)

    @app.get("/admin", include_in_schema=False)
    @app.get("/admin/", include_in_schema=False)
    async def admin_root() -> FileResponse:
        if not admin_index.is_file():
            raise HTTPException(status_code=404, detail="Admin UI not built")
        return FileResponse(admin_index)

    @app.get("/admin/{full_path:path}", include_in_schema=False)
    async def admin_spa(full_path: str) -> FileResponse:
        if not admin_index.is_file():
            raise HTTPException(status_code=404, detail="Admin UI not built")
        if full_path.startswith("api"):
            raise HTTPException(status_code=404)
        candidate = ADMIN_ROOT / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(admin_index)

    @app.get("/{full_path:path}", include_in_schema=False)
    async def public_spa(full_path: str) -> FileResponse:
        if full_path.startswith(("api/", "uploads/", "health")) or full_path == "health":
            raise HTTPException(status_code=404)
        if full_path == "admin" or full_path.startswith("admin/"):
            raise HTTPException(status_code=404)
        candidate = STATIC_ROOT / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index)

    logger.info("Serving public site from %s and admin from %s", STATIC_ROOT, ADMIN_ROOT)
