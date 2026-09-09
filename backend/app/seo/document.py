"""Assemble crawlable HTML from the Vite index shell."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from html import escape
from typing import Any

CANONICAL_HOST = "strugglingwithaddiction.com"
SITE_NAME = "Struggling With Addiction"
DEFAULT_OG_IMAGE = "/images/The-Science-of-Healing-Evidence-Based-Addiction-Treatment_2140317261.webp"
LOGO_PATH = "/images/SWA-logo-web-white-small_vSE-1.webp"
SAME_AS = [
    "https://www.facebook.com/strugglingwithaddictionblog/",
    "https://twitter.com/addiction_with",
    "https://www.youtube.com/channel/UCUcy2jFODQvkvketJ5bZJbA",
]

NAV_LINKS = (
    ("/", "Home"),
    ("/rehab-centers", "Directory"),
    ("/insurance-coverage", "Insurance"),
    ("/blog", "Blog"),
    ("/videos", "Videos"),
    ("/about", "About"),
)

FOOTER_LINKS = (
    ("/", "Home"),
    ("/rehab-centers", "Directory"),
    ("/insurance-coverage", "Insurance coverage"),
    ("/blog", "Blog"),
    ("/videos", "Videos"),
    ("/about", "About"),
    ("/privacy", "Privacy Policy"),
    ("/terms", "Terms of Use"),
    ("/accessibility", "Accessibility"),
)


@dataclass
class SeoPage:
    path: str
    title: str
    description: str
    body_html: str
    canonical: str | None = None
    og_type: str = "website"
    image: str | None = None
    noindex: bool = False
    json_ld: list[dict[str, Any]] = field(default_factory=list)
    status: int = 200


def abs_url(path: str, base: str) -> str:
    if path.startswith("http://") or path.startswith("https://"):
        return path
    root = base.rstrip("/")
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{root}{path}"


def clip_description(text: str, min_len: int = 140, max_len: int = 160) -> str:
    raw = re.sub(r"<[^>]+>", " ", text or "")
    raw = re.sub(r"\s+", " ", raw).strip()
    if not raw:
        raw = (
            "Find licensed rehab and addiction treatment centers, insurance guides, "
            "and recovery articles on Struggling With Addiction."
        )
    if len(raw) < min_len:
        suffix = " Learn more on Struggling With Addiction."
        if suffix.strip() not in raw:
            raw = f"{raw.rstrip('.')}{suffix}"
        if len(raw) < min_len:
            raw = (
                f"{raw} Browse the treatment directory, compare levels of care, "
                "and read evidence-based recovery guides."
            )
    if len(raw) <= max_len:
        return raw
    cut = raw[: max_len - 1]
    if " " in cut:
        cut = cut.rsplit(" ", 1)[0]
    return f"{cut.rstrip('.,;:')}."


def strip_tags(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()


def sanitize_html(html: str) -> str:
    cleaned = re.sub(r"(?is)<script[^>]*>.*?</script>", "", html or "")
    cleaned = re.sub(r"(?is)<style[^>]*>.*?</style>", "", cleaned)
    cleaned = re.sub(r"(?is)<iframe[^>]*>.*?</iframe>", "", cleaned)
    cleaned = re.sub(r"(?i)\son\w+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", "", cleaned)
    return cleaned


def organization_schema(base: str) -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": SITE_NAME,
        "url": base,
        "logo": abs_url(LOGO_PATH, base),
        "sameAs": SAME_AS,
    }


def breadcrumb_schema(base: str, crumbs: list[tuple[str, str]]) -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": index,
                "name": name,
                "item": abs_url(path, base),
            }
            for index, (path, name) in enumerate(crumbs, start=1)
        ],
    }


def chrome(main_html: str) -> str:
    nav = "".join(
        f'<a href="{escape(href)}">{escape(label)}</a>' for href, label in NAV_LINKS
    )
    footer = "".join(
        f'<a href="{escape(href)}">{escape(label)}</a>' for href, label in FOOTER_LINKS
    )
    return (
        f'<header class="site-header"><div class="container header-inner">'
        f'<a class="logo" href="/" aria-label="{escape(SITE_NAME)} home">'
        f'<img class="logo-img" src="{escape(LOGO_PATH)}" alt="{escape(SITE_NAME)}" />'
        f"</a><nav class=\"nav\" aria-label=\"Main navigation\">{nav}</nav></div></header>"
        f'<div class="site-content">{main_html}</div>'
        f'<footer class="site-footer"><div class="container footer-inner">'
        f"<p>You are not alone. Recovery is possible — one day at a time.</p>"
        f"<nav aria-label=\"Footer\">{footer}</nav>"
        f"<p>In crisis? Call or text <a href=\"tel:988\">988</a> (free, 24/7).</p>"
        f"</div></footer>"
    )


def inject(index_html: str, page: SeoPage, base: str) -> str:
    canonical = page.canonical or abs_url(page.path, base)
    image = abs_url(page.image or DEFAULT_OG_IMAGE, base)
    full_title = page.title if page.title.endswith(SITE_NAME) else f"{page.title} | {SITE_NAME}"
    description = clip_description(page.description)
    robots = "noindex, nofollow" if page.noindex else "index, follow"
    json_ld = page.json_ld or [organization_schema(base)]

    meta_bits = [
        f'<title>{escape(full_title)}</title>',
        f'<meta name="description" content="{escape(description)}" />',
        f'<link rel="canonical" href="{escape(canonical)}" />',
        f'<meta name="robots" content="{escape(robots)}" />',
        f'<meta property="og:title" content="{escape(page.title)}" />',
        f'<meta property="og:description" content="{escape(description)}" />',
        f'<meta property="og:url" content="{escape(canonical)}" />',
        f'<meta property="og:type" content="{escape(page.og_type)}" />',
        f'<meta property="og:image" content="{escape(image)}" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        f'<meta name="twitter:title" content="{escape(page.title)}" />',
        f'<meta name="twitter:description" content="{escape(description)}" />',
        f'<meta name="twitter:image" content="{escape(image)}" />',
        '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />',
    ]
    for block in json_ld:
        payload = json.dumps(block, ensure_ascii=False)
        meta_bits.append(
            f'<script type="application/ld+json">{payload}</script>'
        )
    head_extra = "\n    ".join(meta_bits)

    html = re.sub(r"<title>.*?</title>", "", index_html, count=1, flags=re.I | re.S)
    html = re.sub(r'<meta\s+name=["\']description["\'][^>]*>\s*', "", html, flags=re.I)
    html = re.sub(r'<link\s+rel=["\']apple-touch-icon["\'][^>]*>\s*', "", html, flags=re.I)
    if "</head>" in html:
        html = html.replace("</head>", f"    {head_extra}\n  </head>", 1)
    else:
        html = head_extra + html

    root_html = f'<div id="root">{chrome(page.body_html)}</div>'
    html, swapped = re.subn(
        r'<div id="root"\s*></div>',
        root_html,
        html,
        count=1,
        flags=re.I,
    )
    if swapped == 0:
        html = html.replace('<div id="root"></div>', root_html)
    return html
