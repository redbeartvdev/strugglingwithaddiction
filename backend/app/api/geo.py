"""Visitor IP geolocation for directory defaults."""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter(tags=["geo"])
logger = logging.getLogger("swa.geo")

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_TTL_SECONDS = 60 * 60 * 6  # 6 hours

US_STATE_ABBREVS = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
    "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts",
    "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri", "MT": "Montana",
    "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico",
    "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
    "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
    "DC": "District of Columbia",
}

US_STATE_NAMES = {name.lower(): name for name in US_STATE_ABBREVS.values()}


def normalize_us_state(value: str | None) -> str | None:
    raw = " ".join(str(value or "").strip().split())
    if not raw:
        return None
    upper = raw.upper()
    if upper in US_STATE_ABBREVS:
        return US_STATE_ABBREVS[upper]
    return US_STATE_NAMES.get(raw.lower())


class GeoLocationOut(BaseModel):
    ip: str | None = None
    country: str | None = None
    country_code: str | None = None
    state: str | None = None
    region: str | None = None
    city: str | None = None
    source: str = "unknown"


def _client_ip(request: Request) -> str | None:
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    real_ip = (request.headers.get("x-real-ip") or "").strip()
    if real_ip:
        return real_ip
    if request.client and request.client.host:
        return request.client.host
    return None


def _is_private_ip(ip: str | None) -> bool:
    if not ip:
        return True
    if ip in ("127.0.0.1", "::1", "localhost"):
        return True
    if ip.startswith("10.") or ip.startswith("192.168.") or ip.startswith("169.254."):
        return True
    if ip.startswith("172."):
        try:
            second = int(ip.split(".")[1])
            return 16 <= second <= 31
        except (IndexError, ValueError):
            return False
    return False


def _cache_get(key: str) -> dict[str, Any] | None:
    hit = _CACHE.get(key)
    if not hit:
        return None
    expires_at, payload = hit
    if expires_at < time.time():
        _CACHE.pop(key, None)
        return None
    return payload


def _cache_set(key: str, payload: dict[str, Any]) -> None:
    _CACHE[key] = (time.time() + _CACHE_TTL_SECONDS, payload)


def _lookup_ipapi(ip: str) -> dict[str, Any] | None:
    url = f"https://ipapi.co/{ip}/json/"
    with httpx.Client(timeout=4.0) as client:
        res = client.get(url, headers={"User-Agent": "swa-directory/1.0"})
        res.raise_for_status()
        data = res.json()
    if data.get("error"):
        logger.info("ipapi.co error for %s: %s", ip, data.get("reason") or data.get("error"))
        return None
    region = data.get("region") or data.get("region_code")
    state = normalize_us_state(region) or normalize_us_state(data.get("region_code"))
    return {
        "ip": ip,
        "country": data.get("country_name"),
        "country_code": data.get("country_code") or data.get("country"),
        "state": state,
        "region": region,
        "city": (data.get("city") or "").strip() or None,
        "source": "ipapi",
    }


def _lookup_ip_api(ip: str) -> dict[str, Any] | None:
    url = f"http://ip-api.com/json/{ip}"
    with httpx.Client(timeout=4.0) as client:
        res = client.get(
            url,
            params={"fields": "status,message,country,countryCode,region,regionName,city,query"},
        )
        res.raise_for_status()
        data = res.json()
    if data.get("status") != "success":
        logger.info("ip-api.com error for %s: %s", ip, data.get("message"))
        return None
    region = data.get("regionName") or data.get("region")
    state = normalize_us_state(region) or normalize_us_state(data.get("region"))
    return {
        "ip": data.get("query") or ip,
        "country": data.get("country"),
        "country_code": data.get("countryCode"),
        "state": state,
        "region": region,
        "city": (data.get("city") or "").strip() or None,
        "source": "ip-api",
    }


@router.get("/api/geo/me", response_model=GeoLocationOut)
def geo_me(request: Request):
    ip = _client_ip(request)
    if not ip or _is_private_ip(ip):
        return GeoLocationOut(ip=ip, source="local")

    cached = _cache_get(ip)
    if cached:
        return GeoLocationOut(**cached)

    payload: dict[str, Any] | None = None
    try:
        payload = _lookup_ipapi(ip)
    except Exception:
        logger.exception("ipapi.co lookup failed for %s", ip)
    if not payload:
        try:
            payload = _lookup_ip_api(ip)
        except Exception:
            logger.exception("ip-api.com lookup failed for %s", ip)

    if not payload:
        payload = {"ip": ip, "source": "unavailable"}

    _cache_set(ip, payload)
    return GeoLocationOut(**payload)
