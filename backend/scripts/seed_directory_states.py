#!/usr/bin/env python3
"""Seed draft state pillar pages for all US states (publish via admin after clinical review)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.directory_page import DirectoryPage, DirectoryPageStatus, DirectoryPageType

STATES = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
    "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
    "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
    "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
    "Wisconsin", "Wyoming",
]


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def main() -> None:
    db = SessionLocal()
    created = 0
    try:
        for state in STATES:
            slug = slugify(state)
            exists = (
                db.query(DirectoryPage)
                .filter(
                    DirectoryPage.state_slug == slug,
                    DirectoryPage.city_slug.is_(None),
                    DirectoryPage.deleted_at.is_(None),
                )
                .first()
            )
            if exists:
                continue
            page = DirectoryPage(
                page_type=DirectoryPageType.state,
                status=DirectoryPageStatus.draft,
                state_slug=slug,
                title=f"Drug Rehab Centers in {state}",
                body_html=(
                    f"<p>Find accredited addiction treatment centers in {state}. "
                    "This guide is a draft — add clinically reviewed content before publishing.</p>"
                ),
                filter_state=state,
                meta_title=f"Rehab Centers in {state} | Struggling With Addiction",
                meta_description=f"Compare addiction treatment centers in {state}. Insurance, levels of care, and verified listings.",
            )
            db.add(page)
            created += 1
        db.commit()
    finally:
        db.close()
    print(f"Created {created} draft state directory pages")


if __name__ == "__main__":
    main()
