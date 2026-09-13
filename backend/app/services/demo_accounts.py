"""Seeded demo providers and local test accounts that should not appear in finance."""

DEMO_PROVIDER_EMAILS = frozenset({
    "hazelden@example.com",
    "caron@example.com",
})

DEMO_CENTER_SLUGS = frozenset({
    "hazelden-betty-ford-foundation",
    "caron-treatment-centers",
})


def is_demo_or_test_email(email: str | None) -> bool:
    value = (email or "").strip().lower()
    if not value or value == "admin@example.com":
        return False
    local, _, domain = value.partition("@")
    if value in DEMO_PROVIDER_EMAILS:
        return True
    if domain == "example.com":
        return True
    if "+test" in local:
        return True
    if "redbeartv" in domain:
        return True
    return False


def is_demo_center_slug(slug: str | None) -> bool:
    return (slug or "").strip().lower() in DEMO_CENTER_SLUGS
