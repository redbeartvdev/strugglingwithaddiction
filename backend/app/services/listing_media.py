"""Shared listing media defaults for imported / unclaimed centers."""

LISTING_PLACEHOLDER_IMAGE = "/images/rehab/listing-placeholder.avif"
LISTING_PLACEHOLDER_LOGO = "/images/SWA-logo-web-white-small_vSE-1.webp"
_LEGACY_PLACEHOLDERS = {
    "/images/rehab/listing-placeholder.avif",
    "/images/rehab/listing-placeholder.webp",
}


def is_placeholder_listing_image(key: str | None) -> bool:
    raw = str(key or "").strip()
    if not raw:
        return True
    return "listing-placeholder" in raw or raw in _LEGACY_PLACEHOLDERS


def is_custom_listing_image(key: str | None) -> bool:
    return not is_placeholder_listing_image(key)


def listing_image_key(key: str | None) -> str:
    return key if is_custom_listing_image(key) else LISTING_PLACEHOLDER_IMAGE
