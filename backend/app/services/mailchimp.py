"""Mailchimp Marketing API: audience upsert + tags for SWA lifecycle contacts."""
from __future__ import annotations

import base64
import hashlib
import json
import logging
from typing import Any
from urllib import error, request

from sqlalchemy.orm import Session

from app.config import get_settings

logger = logging.getLogger("swa")
settings = get_settings()

ABANDONMENT_TEMPLATE_KEYS = frozenset({"claim_abandon_reminder", "submit_abandon_reminder"})

SOURCE_TAGS = {
    "registration": "swa-registration",
    "claim": "swa-claim",
    "new_center": "swa-new-center",
    "abandonment_claim": "swa-abandonment-claim",
    "abandonment_submit": "swa-abandonment-submit",
}

TEMPLATE_SOURCE = {
    "claim_abandon_reminder": "abandonment_claim",
    "submit_abandon_reminder": "abandonment_submit",
}

# Mailchimp merge-field tags are max 10 characters.
CUSTOM_MERGE_FIELDS = (
    ("PHONE", "Phone", "phone"),
    ("CENTER", "Center name", "text"),
    ("SOURCE", "SWA source", "text"),
    ("CONTURL", "Continue URL", "text"),
)


def resolve_mailchimp(db: Session | None) -> dict[str, Any]:
    from app.services.email import get_platform_email_settings

    row = get_platform_email_settings(db)
    api_key = ""
    audience_id = ""
    enabled = False
    abandonment_emails_enabled = True
    if row is not None:
        enabled = bool(row.mailchimp_enabled)
        api_key = (row.mailchimp_api_key or "").strip()
        audience_id = (row.mailchimp_audience_id or "").strip()
        if row.abandonment_emails_enabled is not None:
            abandonment_emails_enabled = bool(row.abandonment_emails_enabled)
    if not api_key:
        api_key = (settings.mailchimp_api_key or "").strip()
    if not audience_id:
        audience_id = (settings.mailchimp_audience_id or "").strip()
    dc = ""
    if "-" in api_key:
        dc = api_key.rsplit("-", 1)[-1].strip()
    configured = bool(enabled and api_key and audience_id and dc)
    return {
        "enabled": enabled,
        "configured": configured,
        "api_key": api_key,
        "audience_id": audience_id,
        "dc": dc,
        "abandonment_emails_enabled": abandonment_emails_enabled,
        "env_configured": bool(settings.mailchimp_api_key and settings.mailchimp_audience_id),
    }


def abandonment_uses_mailchimp(db: Session | None) -> bool:
    cfg = resolve_mailchimp(db)
    return (not cfg["abandonment_emails_enabled"]) and cfg["configured"]


def _subscriber_hash(email: str) -> str:
    return hashlib.md5(email.strip().lower().encode("utf-8")).hexdigest()


def _split_name(name: str) -> tuple[str, str]:
    parts = (name or "").strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0][:100], ""
    return parts[0][:100], " ".join(parts[1:])[:100]


def _request(
    cfg: dict[str, Any],
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    url = f"https://{cfg['dc']}.api.mailchimp.com/3.0{path}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    basic = base64.b64encode(f"swa:{cfg['api_key']}".encode("utf-8")).decode("ascii")
    req = request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Basic {basic}",
            "Content-Type": "application/json",
            "User-Agent": "strugglingwithaddiction/mailchimp",
        },
    )
    try:
        with request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw) if raw else {}
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:800]
        raise RuntimeError(f"Mailchimp HTTP {exc.code}: {detail}") from exc


_merge_ready: set[str] = set()


def _ensure_merge_fields(cfg: dict[str, Any]) -> None:
    list_id = cfg["audience_id"]
    if list_id in _merge_ready:
        return
    existing: set[str] = set()
    try:
        data = _request(cfg, "GET", f"/lists/{list_id}/merge-fields?count=50")
        for field in data.get("merge_fields") or []:
            tag = str(field.get("tag") or "").upper()
            if tag:
                existing.add(tag)
    except Exception:  # noqa: BLE001
        logger.exception("Mailchimp: failed listing merge fields")
        return
    for tag, name, field_type in CUSTOM_MERGE_FIELDS:
        if tag in existing:
            continue
        try:
            _request(
                cfg,
                "POST",
                f"/lists/{list_id}/merge-fields",
                {"name": name, "type": field_type, "tag": tag, "required": False, "public": False},
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Mailchimp: could not create merge field %s: %s", tag, exc)
    _merge_ready.add(list_id)


def ping_audience(db: Session | None, audience_id: str | None = None) -> dict[str, Any]:
    cfg = resolve_mailchimp(db)
    list_id = (audience_id or cfg["audience_id"] or "").strip()
    if not cfg["api_key"] or not list_id or not cfg["dc"]:
        raise RuntimeError("Mailchimp API key and audience ID are required")
    cfg = {**cfg, "audience_id": list_id}
    data = _request(cfg, "GET", f"/lists/{list_id}")
    return {
        "ok": True,
        "list_id": data.get("id") or list_id,
        "list_name": data.get("name") or "",
        "member_count": (data.get("stats") or {}).get("member_count"),
    }


def list_audiences(db: Session | None) -> list[dict[str, Any]]:
    cfg = resolve_mailchimp(db)
    if not cfg["api_key"] or not cfg["dc"]:
        raise RuntimeError("Mailchimp API key is required")
    data = _request(cfg, "GET", "/lists?count=1000")
    rows = []
    for item in data.get("lists") or []:
        rows.append(
            {
                "id": item.get("id") or "",
                "name": item.get("name") or "",
                "member_count": (item.get("stats") or {}).get("member_count"),
            }
        )
    return rows


def cfg_for_mailing_list(db: Session | None, mailing_list: Any) -> dict[str, Any]:
    cfg = resolve_mailchimp(db)
    audience_id = ((getattr(mailing_list, "mailchimp_audience_id", None) or "") or cfg["audience_id"]).strip()
    enabled = bool(getattr(mailing_list, "mailchimp_enabled", False))
    configured = bool(enabled and cfg["api_key"] and cfg["dc"] and audience_id)
    return {
        **cfg,
        "enabled": enabled,
        "configured": configured,
        "audience_id": audience_id,
    }


def push_mailchimp_member(
    cfg: dict[str, Any],
    *,
    email: str,
    name: str = "",
    phone: str = "",
    center_name: str = "",
    continue_url: str = "",
    source: str = "",
    tags: list[str] | None = None,
) -> None:
    if not cfg.get("configured"):
        raise RuntimeError("Mailchimp is not configured for this list")
    _ensure_merge_fields(cfg)
    fname, lname = _split_name(name)
    member_hash = _subscriber_hash(email)
    merge: dict[str, str] = {}
    if source:
        merge["SOURCE"] = source
    if fname:
        merge["FNAME"] = fname
    if lname:
        merge["LNAME"] = lname
    if phone:
        merge["PHONE"] = phone[:50]
    if center_name:
        merge["CENTER"] = center_name[:255]
    if continue_url:
        merge["CONTURL"] = continue_url[:255]
    _request(
        cfg,
        "PUT",
        f"/lists/{cfg['audience_id']}/members/{member_hash}",
        {
            "email_address": email,
            "status_if_new": "subscribed",
            "merge_fields": merge or {"SOURCE": source or "list"},
        },
    )
    tag_rows = [{"name": tag, "status": "active"} for tag in (tags or []) if (tag or "").strip()]
    if tag_rows:
        _request(
            cfg,
            "POST",
            f"/lists/{cfg['audience_id']}/members/{member_hash}/tags",
            {"tags": tag_rows},
        )


def sync_contact(
    db: Session | None,
    *,
    email: str,
    source: str,
    name: str = "",
    phone: str = "",
    center_name: str = "",
    continue_url: str = "",
    extra_tags: list[str] | None = None,
) -> bool:
    """Upsert the local email list, then Mailchimp when configured. Never raises to callers."""
    email = (email or "").strip().lower()
    if not email or "@" not in email:
        return False
    from app.services.email_list import mark_mailchimp_synced, upsert_list_contact

    upsert_list_contact(
        db,
        email=email,
        source=source,
        name=name,
        phone=phone,
        center_name=center_name,
        continue_url=continue_url,
        extra_tags=extra_tags,
    )
    from app.services.email_list import sync_contact_mailing_lists

    list_synced = sync_contact_mailing_lists(db, email)
    cfg = resolve_mailchimp(db)
    if not cfg["configured"]:
        return list_synced
    tag = SOURCE_TAGS.get(source)
    if not tag:
        logger.warning("Mailchimp: unknown source %s", source)
        return list_synced
    try:
        tags = [tag]
        for extra in extra_tags or []:
            extra = (extra or "").strip()
            if extra:
                tags.append(extra)
        push_mailchimp_member(
            cfg,
            email=email,
            name=name,
            phone=phone,
            center_name=center_name,
            continue_url=continue_url,
            source=source,
            tags=tags,
        )
        mark_mailchimp_synced(db, email)
        logger.info("Mailchimp synced %s source=%s", email, source)
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Mailchimp sync failed for %s source=%s", email, source)
        return list_synced
