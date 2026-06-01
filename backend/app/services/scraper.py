import json
import re
from datetime import datetime, timezone
from urllib.parse import quote_plus, urlparse

import httpx
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.rehab import ScrapeJob, ScrapeJobStatus
from app.services.scrape_settings import get_scrape_settings

SCRAPE_BATCH_SIZE = 15


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:200] or "center"


def _log(job: ScrapeJob, msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    job.error_log = f"{job.error_log}\n{line}" if job.error_log else line


def _find_phone(text: str) -> str | None:
    m = re.search(r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", text)
    return m.group(0) if m else None


def _parse_page(url: str, html: str) -> dict:
    page = BeautifulSoup(html, "html.parser")
    title = page.title.string.strip() if page.title and page.title.string else urlparse(url).netloc
    desc_tag = page.find("meta", attrs={"name": "description"})
    description = desc_tag["content"][:2000] if desc_tag and desc_tag.get("content") else ""
    body_text = page.get_text(" ", strip=True)[:5000]
    phone = _find_phone(body_text)
    services: list[str] = []
    for kw in ("detox", "inpatient", "outpatient", "dual diagnosis", "MAT", "therapy", "residential"):
        if kw.lower() in body_text.lower():
            services.append(kw.title() if kw != "MAT" else "MAT")
    return {
        "name": title[:255],
        "address": "",
        "rating": 4.0,
        "services": services[:8],
        "phone": phone,
        "description": description or body_text[:500],
        "website": url,
        "source_url": url,
    }


def _search_urls(state: str, offset: int = 0, limit: int = SCRAPE_BATCH_SIZE) -> list[str]:
    query = f"best addiction rehab treatment centers {state} USA"
    base = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
    urls: list[str] = []
    page_start = max(0, offset)
    attempts = 0
    while len(urls) < limit and attempts < 4:
        search_url = f"{base}&s={page_start}" if page_start else base
        with httpx.Client(timeout=30, follow_redirects=True) as client:
            resp = client.get(search_url, headers={"User-Agent": "SWA-Bot/1.0"})
            resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        page_urls: list[str] = []
        for a in soup.select("a.result__a"):
            href = a.get("href", "")
            if href.startswith("http") and href not in urls and href not in page_urls:
                page_urls.append(href)
        if not page_urls:
            break
        urls.extend(page_urls)
        page_start += 30
        attempts += 1
    return urls[:limit]


def _llm_extract(db: Session, state: str, snippets: list[dict], limit: int) -> list[dict] | None:
    settings = get_scrape_settings(db)
    key = settings.openai_api_key
    if not key:
        return None
    try:
        import openai

        client = openai.OpenAI(api_key=key)
        prompt = (
            f"Extract up to {limit} addiction rehab centers in {state}, USA from these search snippets. "
            "Return JSON array with objects: name, address, rating (number 1-5), services (string array), "
            "phone, description, website. Use best guess from snippets.\n\n"
            + json.dumps(snippets[:20])[:12000]
        )
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)
        items = data.get("centers") or data.get("results") or data
        if isinstance(items, dict):
            items = items.get("items", [])
        if not isinstance(items, list):
            return None
        out = []
        for item in items[:limit]:
            if not isinstance(item, dict) or not item.get("name"):
                continue
            out.append({
                "name": str(item.get("name", ""))[:255],
                "address": str(item.get("address", ""))[:512],
                "rating": float(item.get("rating") or 4.0),
                "services": [str(s) for s in (item.get("services") or [])][:12],
                "phone": item.get("phone"),
                "description": str(item.get("description", ""))[:2000],
                "website": item.get("website") or item.get("site_link"),
                "source_url": item.get("website") or item.get("source_url"),
            })
        return out if out else None
    except Exception:
        return None


def run_scrape_job(job_id: int, offset: int = 0) -> None:
    db = SessionLocal()
    try:
        job = db.query(ScrapeJob).filter(ScrapeJob.id == job_id).first()
        if not job:
            return
        job.status = ScrapeJobStatus.running
        job.error_log = ""
        db.commit()

        state = job.state or "United States"
        _log(job, f"Searching rehab centers in {state}" + (f" (batch offset {offset})" if offset else ""))
        db.commit()

        results: list[dict] = []
        try:
            if job.query_or_url.startswith("http"):
                urls = [job.query_or_url]
            else:
                urls = _search_urls(state, offset=offset, limit=SCRAPE_BATCH_SIZE)
                _log(job, f"Found {len(urls)} candidate URLs")
                db.commit()

            snippets = []
            with httpx.Client(timeout=20, follow_redirects=True) as client:
                for url in urls:
                    try:
                        resp = client.get(url, headers={"User-Agent": "SWA-Bot/1.0"})
                        if resp.status_code != 200:
                            _log(job, f"Skip {url} ({resp.status_code})")
                            continue
                        item = _parse_page(url, resp.text)
                        item["state"] = state
                        results.append(item)
                        snippets.append({"url": url, "name": item["name"], "description": item["description"][:300]})
                        _log(job, f"Parsed: {item['name']}")
                        db.commit()
                    except Exception as e:
                        _log(job, f"Error fetching {url}: {e}")
                        db.commit()

            llm_results = _llm_extract(db, state, snippets, SCRAPE_BATCH_SIZE)
            if llm_results:
                _log(job, f"LLM enriched {len(llm_results)} results")
                for i, item in enumerate(llm_results):
                    item["state"] = state
                    if i < len(results):
                        for k, v in item.items():
                            if v and (not results[i].get(k) or k in ("address", "rating", "phone")):
                                results[i][k] = v
                    else:
                        results.append(item)

            job.status = ScrapeJobStatus.completed
            job.results_count = len(results)
            job.results_json = json.dumps(results)
            _log(job, f"Completed with {job.results_count} results")
        except Exception as e:
            job.status = ScrapeJobStatus.failed
            _log(job, f"Failed: {e}")
        db.commit()
    finally:
        db.close()


def result_to_center_fields(item: dict) -> dict:
    name = item.get("name") or "Rehab Center"
    slug = _slugify(name)
    location = item.get("address") or item.get("location_display") or ""
    state = item.get("state")
    if state and state not in location:
        location = f"{location}, {state}".strip(", ")
    return {
        "slug": slug,
        "name": name[:255],
        "description": item.get("description") or "",
        "location_display": location[:255],
        "address_line": item.get("address"),
        "state": state,
        "phone": item.get("phone"),
        "website": item.get("website") or item.get("source_url"),
        "rating": float(item.get("rating") or 4.0),
        "specialties": item.get("services") or [],
        "scraped_from_url": item.get("source_url") or item.get("website"),
    }
