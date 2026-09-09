"""Route a public pathname to crawlable page content."""
from __future__ import annotations

import re
from html import escape

from sqlalchemy.orm import Session, joinedload

from app.api.rehab_helpers import (
    center_landing_path,
    find_center_by_landing,
    find_center_by_slug,
    is_indexable_listing,
    published_centers_query,
)
from app.models.blog import Author, Post, PostStatus
from app.models.client_portal import ClientLandingPage
from app.models.insurance import InsuranceCatalog
from app.models.profile import UserProfile
from app.models.rehab import RehabCenter
from app.seo.document import (
    SITE_NAME,
    SeoPage,
    abs_url,
    breadcrumb_schema,
    clip_description,
    organization_schema,
    sanitize_html,
    strip_tags,
)
from app.services.storage import resolve_image_url
UTILITY_PREFIXES = (
    "claim-status/",
    "submit-center/",
)
UTILITY_EXACT = {
    "portal",
    "provider",
    "provider/login",
    "swa-login",
    "unsubscribe",
}

INSURANCE_GUIDES = {
    "aca-parity": (
        "ACA & Mental Health Parity: What It Means for Rehab Coverage",
        "How the Affordable Care Act and mental health parity rules affect addiction treatment coverage — and what to ask your plan.",
        (
            ("What parity requires", "Mental health parity laws require most group health plans and many individual plans to apply financial requirements and treatment limits to substance use benefits that are no more restrictive than those for medical/surgical benefits."),
            ("What the ACA changed", "Marketplace and many employer plans must cover essential health benefits, including behavioral health and substance use disorder services. Medical necessity and network rules still apply."),
            ("What to ask your plan", "Ask for the substance use benefit summary, residential day limits, prior-authorization criteria for detox and residential, and how parity complaints are handled."),
        ),
    ),
    "reading-an-eob": (
        "How to Read an EOB for Rehab & Detox Claims",
        "A plain-language guide to Explanation of Benefits statements after detox, residential, or outpatient addiction treatment.",
        (
            ("Key fields", "Look for the provider name, dates of service, billed amount, allowed amount, plan payment, patient responsibility, and claim status codes."),
            ("Common surprises", "Out-of-network balances, unmet deductibles, concurrent-review denials, and coding mismatches are frequent. Contact billing and your insurer before paying large balances."),
            ("Appeals", "If a day or level of care was denied, ask for the medical-necessity criteria used and file an appeal with clinical notes from the provider."),
        ),
    ),
    "prior-authorization": (
        "Prior Authorization for Detox and Residential Rehab",
        "What prior authorization means for medical detox and residential treatment, and how to prepare before you call admissions.",
        (
            ("Who requests authorization", "Usually the facility’s utilization review team submits clinical information. Confirm the authorization number before travel."),
            ("What plans review", "Plans evaluate withdrawal risk, failed outpatient attempts, co-occurring conditions, and whether a lower level of care is safe."),
            ("If authorization is delayed", "Ask whether emergency admission criteria apply, request peer-to-peer review, and document every call."),
        ),
    ),
    "single-case-agreements": (
        "Single Case Agreements for Out-of-Network Rehab",
        "When and how single case agreements can help you access an out-of-network rehab program at in-network rates.",
        (
            ("What an SCA is", "A single case agreement is a one-time contract between your insurer and an out-of-network facility when no adequate in-network option exists."),
            ("When to ask", "Use an SCA when the clinically appropriate program is out of network or waitlists make in-network care unsafe."),
            ("How to start", "Ask the facility’s insurance team to request the SCA and keep copies of clinical notes and denial letters."),
        ),
    ),
    "calling-your-payer": (
        "Script for Calling Your Insurance About Rehab Coverage",
        "A practical call script for checking detox, residential, and outpatient addiction treatment benefits.",
        (
            ("Have ready", "Member ID, date of birth, the level of care you need, and the facility name if you have one."),
            ("Questions to ask", "In-network status, deductible, prior authorization, residential day limits, and how to appeal a denial."),
            ("After the call", "Write down the reference number, the representative’s name, and any authorization requirements."),
        ),
    ),
}

VIDEOS = (
    ("Why People Deny Being Addicted to Weed?", "A new investigative series featuring Skylar Haarsma."),
    ("What's a Typical Day Like in Rehab?", "An insider view of day-to-day life in a drug and alcohol rehabilitation facility."),
    ("How Do You Convince an Addict To Get Help?", "Tips to help a loved one get treatment for addiction."),
    ("Cognitive Behavioral Therapy", "What CBT is and how it can help someone with a substance use disorder."),
    ("Warning Signs of Substance Abuse", "How drugs may be affecting life in ways that are easy to miss."),
    ("How Drugs Affect Your Quality of Life", "The impact of substance use on health, work, and relationships."),
    ("Knowing the Risk Factors of Drug Addiction", "Risk factors that make addiction more likely, and what to watch for."),
    ("How Does Suboxone Help Addiction Recovery?", "How medication-assisted treatment can support recovery."),
)


def _p(*paragraphs: str) -> str:
    return "".join(f"<p>{escape(item)}</p>" for item in paragraphs if item)


def _list(items: list[str], ordered: bool = False) -> str:
    if not items:
        return ""
    tag = "ol" if ordered else "ul"
    inner = "".join(f"<li>{escape(item)}</li>" for item in items if item)
    return f"<{tag}>{inner}</{tag}>"


def _links(items: list[tuple[str, str]]) -> str:
    if not items:
        return ""
    inner = "".join(
        f'<li><a href="{escape(href)}">{escape(label)}</a></li>' for href, label in items if href and label
    )
    return f"<ul>{inner}</ul>"


def not_found_page(path: str, base: str) -> SeoPage:
    body = (
        "<main class=\"not-found-page\"><section class=\"container\">"
        "<p>404</p><h1>This Page Isn’t Here — But Help Still Is</h1>"
        + _p(
            "The page you are looking for may have moved, been removed, or the address might be mistyped. "
            "The treatment directory, recovery articles, and crisis resources are still one click away.",
            "In crisis? Call or text 988 (free, 24/7). If you are looking for treatment, search licensed rehab centers by state, insurance, or level of care.",
        )
        + _links(
            [
                ("/", "Home"),
                ("/rehab-centers", "Treatment directory"),
                ("/blog", "Recovery articles"),
                ("/insurance-coverage", "Insurance coverage"),
            ]
        )
        + "</section></main>"
    )
    return SeoPage(
        path=path or "/404",
        title="Page Not Found",
        description=(
            "This page is not available. Search licensed rehab centers, read recovery articles, "
            "or call 988 for crisis support on Struggling With Addiction."
        ),
        body_html=body,
        noindex=True,
        status=404,
        json_ld=[organization_schema(base)],
    )


def _home(db: Session, base: str) -> SeoPage:
    posts = (
        db.query(Post)
        .filter(Post.status == PostStatus.published, Post.deleted_at.is_(None), Post.seo_noindex.is_(False))
        .order_by(Post.published_at.desc().nullslast())
        .limit(8)
        .all()
    )
    post_links = [(f"/blog/{post.slug}", strip_tags(post.title)) for post in posts if post.slug]
    body = (
        "<main><section class=\"hero\">"
        "<p>You Are Not Alone</p>"
        "<h1>Find licensed rehab and treatment centers near you</h1>"
        + _p(
            "Search licensed addiction treatment centers across the United States, filter by state or the kind of care you need, "
            "and get straight answers about detox, residential, outpatient, and recovery.",
            "Forty-eight million Americans struggle with addiction, and only about 10% receive treatment. "
            "This directory helps families compare accredited facilities, understand insurance coverage, and contact admissions directly.",
            "In crisis? Call or text 988 anytime. For treatment search, start with the national directory or jump to insurance guides and evidence-based articles.",
        )
        + "<h2>How to use the directory</h2>"
        + _list(
            [
                "Browse licensed treatment centers by state on the directory map.",
                "Filter by detox, inpatient, outpatient, dual diagnosis, or medication-assisted treatment.",
                "Read verified or claimed listings, then contact the facility or send a private inquiry.",
                "Use insurance guides to learn what Aetna, Cigna, Medicaid, and other plans typically cover.",
            ]
        )
        + "<h2>Explore treatment resources</h2>"
        + _links(
            [
                ("/rehab-centers", "Search treatment centers"),
                ("/insurance-coverage", "Does my insurance cover rehab?"),
                ("/blog", "Articles and recovery guidance"),
                ("/videos", "Video guides on addiction and recovery"),
                ("/about", "About our editors"),
            ]
        )
        + ("<h2>Latest articles</h2>" + _links(post_links) if post_links else "")
        + "</section></main>"
    )
    return SeoPage(
        path="/",
        title="Find Rehab & Addiction Treatment Centers",
        description=(
            "Find licensed rehab and addiction treatment centers near you. Compare care types, "
            "check insurance, and read recovery guides from Struggling With Addiction."
        ),
        body_html=body,
        json_ld=[organization_schema(base)],
    )


def _about(base: str) -> SeoPage:
    body = (
        "<main class=\"about-page\"><h1>About</h1>"
        + _p(
            "Struggling With Addiction is an independent directory and newsroom that helps people find licensed treatment centers, understand insurance, and read clear reporting on addiction and recovery.",
            "Our editors and reporters review listings, explain levels of care, and publish evidence-based articles so families are not left guessing who is legitimate.",
            "Meet the team, read author bios, or write for us at writers@strugglingwithaddiction.com. The directory is free to search. Providers can claim a listing from the portal.",
        )
        + "<h2>Our work</h2>"
        + _list(
            [
                "National treatment directory with state and insurance filters",
                "Investigative and educational journalism on drugs, policy, and recovery",
                "Insurance explainers for major commercial, Medicaid, Medicare, and TRICARE plans",
            ]
        )
        + _links([("/author/drew-lewis", "Drew Lewis"), ("/rehab-centers", "Browse the directory")])
        + "</main>"
    )
    return SeoPage(
        path="/about",
        title="About Our Editors & Treatment Directory",
        description=(
            "Meet the editors behind Struggling With Addiction — a national rehab directory "
            "and newsroom covering treatment, insurance, and recovery."
        ),
        body_html=body,
        json_ld=[
            organization_schema(base),
            breadcrumb_schema(base, [("/", "Home"), ("/about", "About")]),
        ],
    )


def _legal(path: str, heading: str, title: str, description: str, paragraphs: list[str], base: str) -> SeoPage:
    h2 = "Need help right now?"
    body = (
        f"<main><h1>{escape(heading)}</h1>"
        + _p(*paragraphs)
        + f"<h2>{escape(h2)}</h2>"
        + _p("In crisis? Call or text 988 (free, 24/7). Browse verified treatment centers in our directory.")
        + _links([("/rehab-centers", "Search treatment centers"), ("/", "Home")])
        + "</main>"
    )
    return SeoPage(
        path=path,
        title=title,
        description=description,
        body_html=body,
        json_ld=[organization_schema(base), breadcrumb_schema(base, [("/", "Home"), (path, heading)])],
    )


def _videos(base: str) -> SeoPage:
    items = "".join(
        f"<article><h2>{escape(title)}</h2><p>{escape(desc)}</p></article>" for title, desc in VIDEOS
    )
    body = (
        "<main><h1>Video Guides on Addiction & Recovery</h1>"
        + _p(
            "Whether you are searching for yourself or supporting someone you love, these short videos explain addiction, treatment, and recovery without the jargon.",
            "Learn how to spot warning signs, understand levels of care, and explore what rehab, therapy, and medication-assisted treatment involve so you can make informed decisions.",
        )
        + items
        + _links([("/rehab-centers", "Find a treatment center"), ("https://www.youtube.com/channel/UCUcy2jFODQvkvketJ5bZJbA", "YouTube channel")])
        + "</main>"
    )
    return SeoPage(
        path="/videos",
        title="Video Guides on Addiction & Recovery",
        description=(
            "Plain-language videos on addiction, treatment, and recovery — warning signs, rehab, "
            "CBT, medication-assisted treatment, and more."
        ),
        body_html=body,
        json_ld=[organization_schema(base), breadcrumb_schema(base, [("/", "Home"), ("/videos", "Videos")])],
    )


def _directory(db: Session, base: str) -> SeoPage:
    rows = (
        published_centers_query(db)
        .with_entities(RehabCenter.state)
        .filter(RehabCenter.state.isnot(None))
        .distinct()
        .all()
    )
    states = sorted({(row[0] or "").strip() for row in rows if (row[0] or "").strip()})
    state_links = [
        (f"/rehab-centers/state/{re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')}", f"Rehab centers in {name}")
        for name in states
    ]
    body = (
        "<main class=\"rehab-page\"><h1>Trusted Rehab Centers Across the USA</h1>"
        + _p(
            "Accredited treatment facilities with proven track records of helping people reclaim their lives from addiction.",
            "Search licensed rehab centers by state, city, insurance, and level of care — including detox, inpatient, outpatient, dual diagnosis, and medication-assisted treatment.",
            "Listings are reviewed by our team or maintained by the center. Claimed providers can publish photos, insurance details, and an inquiry form. Always confirm services and coverage with the facility before admission.",
        )
        + "<h2>Browse by state</h2>"
        + _links(state_links[:60])
        + "<h2>Next steps</h2>"
        + _links(
            [
                ("/insurance-coverage", "Check insurance coverage"),
                ("/portal", "Providers: claim your listing"),
                ("/blog", "Read recovery articles"),
            ]
        )
        + "</main>"
    )
    return SeoPage(
        path="/rehab-centers",
        title="Trusted Rehab Centers Across the USA",
        description=(
            "Search licensed rehab centers across the United States. Filter by state, insurance, "
            "detox, inpatient, and outpatient care on Struggling With Addiction."
        ),
        body_html=body,
        json_ld=[
            organization_schema(base),
            breadcrumb_schema(base, [("/", "Home"), ("/rehab-centers", "Rehab centers")]),
        ],
    )


def _facility(db: Session, state: str, city: str, facility: str, base: str) -> SeoPage | None:
    center = find_center_by_landing(db, state, city, facility)
    if not center or not is_indexable_listing(center):
        return None
    path = center_landing_path(center) or f"/rehabs/united-states/{state}/{city}/{facility}"
    place = ", ".join(part for part in [center.city, center.state] if part)
    services = [str(item) for item in (center.specialties or [])[:12] if item]
    levels = [str(item) for item in (center.levels_of_care or [])[:12] if item]
    description = (center.description or "").strip()
    if not description:
        description = (
            f"{center.name} is a treatment facility listed in {place}. "
            "Review published services and contact the center or claim the listing to keep details current."
        )
    primary = (levels[0] if levels else None) or (services[0] if services else "addiction treatment")
    meta = (
        f"{center.name} in {place} offers {primary}. See services, location, and how to inquire "
        "or claim this listing on Struggling With Addiction."
    )
    body = (
        f"<main class=\"rpd-page\"><h1>{escape(center.name)}</h1>"
        + _p(f"Treatment center in {place}." if place else "Treatment center listed in our directory.")
        + _p(description[:1200])
        + "<h2>Care offered</h2>"
        + ("<h3>Services</h3>" + _list(services) if services else "<p>Services are listed when the center publishes them.</p>")
        + ("<h3>Levels of care</h3>" + _list(levels) if levels else "")
        + "<h2>Location</h2>"
        + _p(place or center.location_display or "Location listed in the directory.")
        + "<h2>Next step</h2>"
        + _p(
            "Send a private inquiry on this page after it loads, or search nearby programs in the directory. "
            "Always confirm admissions, insurance, and medical necessity with the facility."
        )
        + _links(
            [
                ("/rehab-centers", "Back to directory"),
                (
                    f"/rehab-centers/state/{re.sub(r'[^a-z0-9]+', '-', (center.state or '').lower()).strip('-')}",
                    f"More centers in {center.state}" if center.state else "Directory by state",
                ),
            ]
        )
        + "</main>"
    )
    schema: dict = {
        "@context": "https://schema.org",
        "@type": "MedicalBusiness",
        "name": center.name,
        "url": abs_url(path, base),
        "description": clip_description(description),
    }
    address = {
        "@type": "PostalAddress",
        "addressCountry": "US",
    }
    if center.city:
        address["addressLocality"] = center.city
    if center.state:
        address["addressRegion"] = center.state
    schema["address"] = address
    json_ld = [
        organization_schema(base),
        breadcrumb_schema(
            base,
            [
                ("/", "Home"),
                ("/rehab-centers", "Rehab centers"),
                (path, center.name),
            ],
        ),
        schema,
    ]
    return SeoPage(
        path=path,
        title=f"{center.name} in {place}" if place else center.name,
        description=meta,
        body_html=body,
        og_type="website",
        json_ld=json_ld,
    )


def _location(db: Session, state: str, city: str | None, base: str) -> SeoPage | None:
    state_slug = re.sub(r"[^a-z0-9]+", "-", state.lower()).strip("-")
    city_slug = re.sub(r"[^a-z0-9]+", "-", (city or "").lower()).strip("-")
    centers = published_centers_query(db).all()
    matched: list[RehabCenter] = []
    for center in centers:
        if re.sub(r"[^a-z0-9]+", "-", (center.state or "").lower()).strip("-") != state_slug:
            continue
        if city_slug and re.sub(r"[^a-z0-9]+", "-", (center.city or "").lower()).strip("-") != city_slug:
            continue
        if is_indexable_listing(center):
            matched.append(center)
    if not matched:
        return None
    place = f"{matched[0].city}, {matched[0].state}" if city else (matched[0].state or state)
    path = (
        f"/rehab-centers/state/{state_slug}/city/{city_slug}"
        if city_slug
        else f"/rehab-centers/state/{state_slug}"
    )
    links = []
    for center in matched[:40]:
        landing = center_landing_path(center)
        if landing:
            links.append((landing, f"{center.name} — {center.location_display or ''}"))
    body = (
        f"<main><h1>Rehab centers in {escape(place)}</h1>"
        + _p(
            f"Explore licensed treatment facilities listed in {place}. Filter from the national directory or open a facility page for services and next steps.",
            "Providers can claim their listing to keep phone numbers, insurance, and photos current. Always confirm admissions details with the center.",
        )
        + "<h2>Facilities</h2>"
        + _links(links)
        + _links([("/rehab-centers", "All rehab centers")])
        + "</main>"
    )
    return SeoPage(
        path=path,
        title=f"Rehab Centers in {place}",
        description=(
            f"Find rehab and addiction treatment centers in {place}. Compare listed programs "
            "and contact facilities on Struggling With Addiction."
        ),
        body_html=body,
        json_ld=[
            organization_schema(base),
            breadcrumb_schema(base, [("/", "Home"), ("/rehab-centers", "Rehab centers"), (path, place)]),
        ],
    )


def _blog_index(db: Session, base: str) -> SeoPage:
    posts = (
        db.query(Post)
        .filter(Post.status == PostStatus.published, Post.deleted_at.is_(None), Post.seo_noindex.is_(False))
        .order_by(Post.published_at.desc().nullslast())
        .limit(40)
        .all()
    )
    links = [(f"/blog/{post.slug}", strip_tags(post.title)) for post in posts if post.slug]
    body = (
        "<main><h1>Articles & Guidance for Recovery</h1>"
        + _p(
            "Evidence-based articles, personal stories, and practical guidance for every step of the recovery journey.",
            "Read reporting on synthetic opioids, treatment medications, family support, insurance, and policy — then use the directory to find licensed care.",
        )
        + "<h2>Latest articles</h2>"
        + _links(links)
        + "</main>"
    )
    return SeoPage(
        path="/blog",
        title="Articles & Guidance for Recovery",
        description=(
            "Evidence-based articles and practical guidance on addiction, treatment, and recovery "
            "from the editors of Struggling With Addiction."
        ),
        body_html=body,
        json_ld=[organization_schema(base), breadcrumb_schema(base, [("/", "Home"), ("/blog", "Blog")])],
    )


def _blog_post(db: Session, slug: str, base: str) -> SeoPage | None:
    post = (
        db.query(Post)
        .options(joinedload(Post.author), joinedload(Post.categories))
        .filter(Post.slug == slug, Post.deleted_at.is_(None))
        .first()
    )
    if not post or post.status != PostStatus.published or post.seo_noindex or post.visibility_password_hash:
        return None
    title = strip_tags(post.meta_title or post.title)
    excerpt = strip_tags(post.meta_description or post.excerpt or "")
    article = sanitize_html(post.content_html or "")
    if len(strip_tags(article)) < 200:
        article += _p(
            "This article is part of Struggling With Addiction’s recovery library. "
            "Use the directory to find licensed treatment if you or a loved one needs care now."
        )
    author_name = post.author.name if post.author else None
    path = f"/blog/{post.slug}"
    body = (
        f"<main class=\"post-page\"><article><h1>{escape(title)}</h1>"
        + (f"<p>By <a href=\"/author/{escape(post.author.slug)}\">{escape(author_name)}</a></p>" if post.author and post.author.slug else "")
        + (f"<p>{escape(excerpt)}</p>" if excerpt else "")
        + article
        + "</article><h2>Find treatment</h2>"
        + _p("If you are looking for licensed care, search the national treatment directory by state or insurance.")
        + _links([("/rehab-centers", "Search treatment centers"), ("/blog", "More articles")])
        + "</main>"
    )
    article_ld: dict = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "description": clip_description(excerpt or title),
        "mainEntityOfPage": abs_url(path, base),
        "publisher": {"@type": "Organization", "name": SITE_NAME, "url": base},
    }
    if post.author:
        article_ld["author"] = {
            "@type": "Person",
            "name": post.author.name,
            **({"url": abs_url(f"/author/{post.author.slug}", base)} if post.author.slug else {}),
        }
    if post.published_at:
        article_ld["datePublished"] = post.published_at.date().isoformat()
    if post.updated_at:
        article_ld["dateModified"] = post.updated_at.date().isoformat()
    return SeoPage(
        path=path,
        title=title,
        description=excerpt or title,
        body_html=body,
        og_type="article",
        image=resolve_image_url(post.featured_image_key),
        json_ld=[
            organization_schema(base),
            breadcrumb_schema(base, [("/", "Home"), ("/blog", "Blog"), (path, title)]),
            article_ld,
        ],
    )


def _author(db: Session, slug: str, base: str) -> SeoPage | None:
    author = db.query(Author).filter(Author.slug == slug).first()
    if not author:
        return None
    posts = (
        db.query(Post)
        .filter(
            Post.author_id == author.id,
            Post.status == PostStatus.published,
            Post.deleted_at.is_(None),
            Post.seo_noindex.is_(False),
        )
        .order_by(Post.published_at.desc().nullslast())
        .limit(24)
        .all()
    )
    path = f"/author/{author.slug}"
    body = (
        f"<main><h1>{escape(author.name)}</h1>"
        + _p(author.title or "Author", author.bio or f"{author.name} writes about addiction treatment and recovery.")
        + f"<p>{len(posts)} article{'s' if len(posts) != 1 else ''} published</p>"
        + "<h2>Articles</h2>"
        + _links([(f"/blog/{post.slug}", strip_tags(post.title)) for post in posts])
        + "</main>"
    )
    return SeoPage(
        path=path,
        title=author.name,
        description=clip_description(author.bio or f"Articles by {author.name} on addiction, treatment, and recovery."),
        body_html=body,
        json_ld=[
            organization_schema(base),
            {
                "@context": "https://schema.org",
                "@type": "Person",
                "name": author.name,
                "url": abs_url(path, base),
                **({"jobTitle": author.title} if author.title else {}),
                **({"description": author.bio} if author.bio else {}),
            },
        ],
    )


def _insurance_hub(base: str) -> SeoPage:
    guide_links = [
        (f"/insurance-coverage/guides/{slug}", data[0]) for slug, data in INSURANCE_GUIDES.items()
    ]
    body = (
        "<main><h1>Does my insurance cover rehab?</h1>"
        + _p(
            "Learn how major carriers typically cover addiction treatment, then browse facilities in our directory that attest to accepting that plan.",
            "Listings are self-reported — always confirm benefits with the center and your insurer. Coverage depends on medical necessity, network status, and prior authorization.",
        )
        + "<h2>Guides</h2>"
        + _links(guide_links)
        + "<h2>Popular carriers</h2>"
        + _links(
            [
                ("/insurance/aetna", "Does Aetna cover rehab?"),
                ("/insurance/cigna", "Does Cigna cover rehab?"),
                ("/insurance/blue-cross-blue-shield", "Does Blue Cross Blue Shield cover rehab?"),
                ("/insurance/unitedhealthcare", "Does UnitedHealthcare cover rehab?"),
                ("/insurance/medicaid", "Does Medicaid cover rehab?"),
            ]
        )
        + "</main>"
    )
    return SeoPage(
        path="/insurance-coverage",
        title="Insurance Coverage for Rehab",
        description=(
            "Does your insurance cover rehab? Learn how major plans typically cover addiction "
            "treatment and find facilities that list your carrier."
        ),
        body_html=body,
        json_ld=[
            organization_schema(base),
            breadcrumb_schema(base, [("/", "Home"), ("/insurance-coverage", "Insurance")]),
        ],
    )


def _insurance_guide(slug: str, base: str) -> SeoPage | None:
    data = INSURANCE_GUIDES.get(slug)
    if not data:
        return None
    title, description, sections = data
    path = f"/insurance-coverage/guides/{slug}"
    sections_html = "".join(
        f"<h2>{escape(heading)}</h2><p>{escape(body)}</p>" for heading, body in sections
    )
    body = (
        f"<main><h1>{escape(title)}</h1>"
        + _p(description)
        + sections_html
        + _p("This is educational information, not a benefits guarantee. Confirm coverage with your plan and the facility.")
        + _links([("/insurance-coverage", "Insurance hub"), ("/rehab-centers", "Find a center")])
        + "</main>"
    )
    return SeoPage(
        path=path,
        title=title,
        description=description,
        body_html=body,
        json_ld=[
            organization_schema(base),
            breadcrumb_schema(base, [("/", "Home"), ("/insurance-coverage", "Insurance"), (path, title)]),
        ],
    )


def _insurance_carrier(db: Session, slug: str, base: str) -> SeoPage | None:
    row = (
        db.query(InsuranceCatalog)
        .filter(InsuranceCatalog.slug == slug, InsuranceCatalog.enabled.is_(True))
        .first()
    )
    if not row:
        return None
    path = f"/insurance/{row.slug}"
    title = row.hero_title or f"Does {row.name} cover rehab?"
    summary = strip_tags(row.summary or row.meta_description or "")
    html = sanitize_html(row.content_html or "")
    body = (
        f"<main><h1>{escape(title)}</h1>"
        + _p(summary or f"Learn how {row.name} typically covers addiction treatment and what to ask your plan.")
        + html
        + _p(
            "Listings self-attest which carriers they accept. Struggling With Addiction does not verify your specific plan benefits. Always confirm coverage with the facility and your insurer."
        )
        + _links(
            [
                (f"/rehab-centers?insurance={row.name}", f"Directory listings that list {row.name}"),
                ("/insurance-coverage", "All insurance guides"),
            ]
        )
        + "</main>"
    )
    return SeoPage(
        path=path,
        title=row.meta_title or title,
        description=row.meta_description or summary or title,
        body_html=body,
        json_ld=[
            organization_schema(base),
            breadcrumb_schema(base, [("/", "Home"), ("/insurance-coverage", "Insurance"), (path, row.name)]),
        ],
    )


def _partner(db: Session, slug: str, base: str) -> SeoPage | None:
    row = (
        db.query(UserProfile, ClientLandingPage)
        .join(ClientLandingPage, ClientLandingPage.user_id == UserProfile.user_id)
        .filter(UserProfile.slug == slug, ClientLandingPage.is_published.is_(True))
        .first()
    )
    if not row:
        return None
    profile, landing = row
    path = f"/partners/{profile.slug}"
    heading = landing.headline or profile.display_name or profile.slug
    body = (
        f"<main><h1>{escape(heading)}</h1>"
        + _p(strip_tags(landing.about_html or landing.headline or "Partner page on Struggling With Addiction."))
        + _links([("/rehab-centers", "Treatment directory"), ("/blog", "Articles")])
        + "</main>"
    )
    return SeoPage(
        path=path,
        title=heading,
        description=clip_description(strip_tags(landing.about_html or heading)),
        body_html=body,
        json_ld=[organization_schema(base)],
    )


def _utility(path: str, heading: str, blurb: str, base: str) -> SeoPage:
    body = f"<main><h1>{escape(heading)}</h1>" + _p(blurb) + _links([("/", "Home")]) + "</main>"
    return SeoPage(
        path=path,
        title=heading,
        description=clip_description(blurb),
        body_html=body,
        noindex=True,
        json_ld=[organization_schema(base)],
    )


def resolve_public_page(path: str, db: Session, base: str) -> SeoPage | None:
    """Return a page for a normalized public path, or None to 404."""
    raw = path or "/"
    if not raw.startswith("/"):
        raw = f"/{raw}"
    if len(raw) > 1:
        raw = raw.rstrip("/")

    if raw == "/":
        return _home(db, base)
    if raw == "/about":
        return _about(base)
    if raw == "/privacy":
        return _legal(
            "/privacy",
            "Privacy Policy",
            "Privacy Policy",
            "How Struggling With Addiction collects, uses, and protects personal information on this treatment directory and newsroom.",
            [
                "Struggling With Addiction is committed to protecting your privacy. We collect contact information you submit, usage data, and messages sent through our forms.",
                "We do not sell personal information. Listing inquiries are emailed to the treatment center and are not stored in our database.",
                "You may disable cookies in your browser. Some features may not work without them. Contact info@strugglingwithaddiction.com for data requests.",
            ],
            base,
        )
    if raw == "/terms":
        return _legal(
            "/terms",
            "Terms of Use",
            "Terms of Use",
            "Terms of use for Struggling With Addiction, including directory listings, articles, and provider portal access.",
            [
                "By using this website you agree to these terms. Content is for general information and is not a substitute for professional medical advice, diagnosis, or treatment.",
                "Directory listings may be supplied by facilities or public data sources. Always verify services, licensing, and insurance directly with the provider.",
                "You may not scrape the site in a way that degrades service or misrepresents our content. We may update these terms; the date is posted on the page.",
            ],
            base,
        )
    if raw == "/accessibility":
        return _legal(
            "/accessibility",
            "Accessibility",
            "Accessibility",
            "Accessibility commitment for Struggling With Addiction, including how to request help using the treatment directory.",
            [
                "We aim to make the directory, articles, and tools usable for people with disabilities and to meet commonly referenced WCAG guidance.",
                "If you have trouble using a page, email info@strugglingwithaddiction.com and describe the barrier. Crisis support remains available at 988.",
                "We continue to improve keyboard access, contrast, and text alternatives as we ship the public site.",
            ],
            base,
        )
    if raw == "/videos":
        return _videos(base)
    if raw == "/rehab-centers":
        return _directory(db, base)
    if raw == "/blog":
        return _blog_index(db, base)
    if raw == "/insurance-coverage":
        return _insurance_hub(base)
    if raw == "/portal":
        return _utility(
            "/portal",
            "Provider Login",
            "Sign in to manage a claimed treatment listing, leads, billing, and partner tools. This page is not indexed.",
            base,
        )

    m = re.fullmatch(r"/blog/([^/]+)", raw)
    if m:
        return _blog_post(db, m.group(1), base)
    m = re.fullmatch(r"/author/([^/]+)", raw)
    if m:
        return _author(db, m.group(1), base)
    m = re.fullmatch(r"/insurance-coverage/guides/([^/]+)", raw)
    if m:
        return _insurance_guide(m.group(1), base)
    m = re.fullmatch(r"/insurance/([^/]+)", raw)
    if m:
        return _insurance_carrier(db, m.group(1), base)
    m = re.fullmatch(r"/insurance-coverage/([^/]+)", raw)
    if m and m.group(1) != "guides":
        return None  # handled as redirect in the server
    m = re.fullmatch(r"/partners/([^/]+)", raw)
    if m:
        return _partner(db, m.group(1), base)
    m = re.fullmatch(r"/rehabs/united-states/([^/]+)/([^/]+)/([^/]+)", raw)
    if m:
        return _facility(db, m.group(1), m.group(2), m.group(3), base)
    m = re.fullmatch(r"/rehab-centers/state/([^/]+)/city/([^/]+)", raw)
    if m:
        return _location(db, m.group(1), m.group(2), base)
    m = re.fullmatch(r"/rehab-centers/state/([^/]+)", raw)
    if m:
        return _location(db, m.group(1), None, base)

    stripped = raw.lstrip("/")
    if stripped in UTILITY_EXACT or any(stripped.startswith(prefix) for prefix in UTILITY_PREFIXES):
        return _utility(raw, "Account tools", "This is a private or utility page for providers and email preferences. It is not indexed in search results.", base)
    return None


def legacy_center_redirect(db: Session, path: str) -> str | None:
    """Map WordPress /rehab-centers/{slug} to the canonical landing URL."""
    m = re.fullmatch(r"/rehab-centers/([^/]+)", path.rstrip("/") if path != "/" else path)
    if not m:
        return None
    slug = m.group(1)
    if slug in {"state"}:
        return None
    center = find_center_by_slug(db, slug)
    if not center or not is_indexable_listing(center):
        return None
    return center_landing_path(center)


def insurance_legacy_redirect(path: str) -> str | None:
    m = re.fullmatch(r"/insurance-coverage/([^/]+)", path.rstrip("/") if len(path) > 1 else path)
    if not m:
        return None
    slug = m.group(1)
    if slug in {"guides"}:
        return None
    return f"/insurance/{slug}"
