"""HTTP redirects for the public HTML server.

Keep SEARCH_CONSOLE_REDIRECTS in sync with src/redirects.js.
Do not chain: `to` must be a final canonical path (no trailing slash).
"""
from __future__ import annotations

# Populate from Search Console exports. Example:
# {"from": "/old-slug", "to": "/blog/new-slug", "status": 301}
SEARCH_CONSOLE_REDIRECTS: list[dict] = []

BUILTIN_REDIRECTS: list[dict] = [
    {"from": "/our-team", "to": "/about", "status": 301},
    {"from": "/privacy-policy-2", "to": "/privacy", "status": 301},
]


def _norm(path: str) -> str:
    raw = (path or "").split("?", 1)[0].split("#", 1)[0]
    if not raw.startswith("/"):
        raw = f"/{raw}"
    if len(raw) > 1:
        raw = raw.rstrip("/")
    return raw or "/"


def lookup_redirect(path: str) -> tuple[str, int] | None:
    """Return (to, status) for an exact path, with or without a trailing slash."""
    candidates = {path, _norm(path)}
    if path.endswith("/") and path != "/":
        candidates.add(path.rstrip("/"))
    elif path != "/":
        candidates.add(f"{path}/")
    for entry in (*BUILTIN_REDIRECTS, *SEARCH_CONSOLE_REDIRECTS):
        source = entry.get("from") or ""
        dest = entry.get("to") or ""
        if _norm(source) in {_norm(item) for item in candidates} or source in candidates:
            status = int(entry.get("status") or 301)
            return _norm(dest), status if status in (301, 302) else 301
    return None
