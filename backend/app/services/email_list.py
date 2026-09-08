"""Platform-owned mailing lists: contacts, named lists, and Mailchimp sync."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.center_submission import CenterSubmission
from app.models.email_list import EmailListContact, MailingList, MailingListMember
from app.models.lead import CenterLead
from app.models.rehab import RehabCenterClaim
from app.models.user import User, UserRole

VALID_STATUSES = frozenset({"subscribed", "unsubscribed"})
LIST_SOURCES = (
    "registration",
    "claim",
    "new_center",
    "abandonment_claim",
    "abandonment_submit",
    "manual",
)
SYSTEM_LISTS = (
    ("registrations", "Registrations", "New account registrations.", ("registration",)),
    ("claims", "Claims", "Listing claim journeys.", ("claim",)),
    ("new-centers", "New centers", "Submit-your-center requests.", ("new_center",)),
    ("abandonment-claim", "Abandonment · Claim", "Abandoned claim reminders.", ("abandonment_claim",)),
    ("abandonment-submit", "Abandonment · Submit", "Abandoned submit-center reminders.", ("abandonment_submit",)),
)


def _source_tags() -> dict[str, str]:
    from app.services.mailchimp import SOURCE_TAGS

    return SOURCE_TAGS


def _now() -> datetime:
    return datetime.now(timezone.utc)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return (slug or "list")[:80]


def unique_slug(db: Session, name: str, exclude_id: int | None = None) -> str:
    base = slugify(name)
    slug = base
    n = 2
    while True:
        q = db.query(MailingList).filter(MailingList.slug == slug)
        if exclude_id is not None:
            q = q.filter(MailingList.id != exclude_id)
        if q.first() is None:
            return slug
        slug = f"{base}-{n}"[:80]
        n += 1


def ensure_system_lists(db: Session) -> None:
    changed = False
    for slug, name, description, sources in SYSTEM_LISTS:
        row = db.query(MailingList).filter(MailingList.slug == slug).first()
        if row is None:
            db.add(
                MailingList(
                    name=name,
                    slug=slug,
                    description=description,
                    auto_sources=list(sources),
                    is_system=True,
                    mailchimp_tag=f"swa-{slug}",
                )
            )
            changed = True
    if changed:
        db.commit()


def serialize_list(row: MailingList, member_count: int | None = None) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "slug": row.slug,
        "description": row.description or "",
        "auto_sources": list(row.auto_sources or []),
        "is_system": bool(row.is_system),
        "mailchimp_enabled": bool(row.mailchimp_enabled),
        "mailchimp_audience_id": row.mailchimp_audience_id or "",
        "mailchimp_tag": row.mailchimp_tag or "",
        "member_count": int(member_count or 0),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def serialize_contact(row: EmailListContact) -> dict[str, Any]:
    lists = []
    for membership in row.memberships or []:
        mailing_list = membership.mailing_list
        if mailing_list is None:
            continue
        lists.append(
            {
                "id": mailing_list.id,
                "name": mailing_list.name,
                "slug": mailing_list.slug,
                "mailchimp_enabled": bool(mailing_list.mailchimp_enabled),
                "synced_at": membership.mailchimp_synced_at,
            }
        )
    return {
        "id": row.id,
        "email": row.email,
        "name": row.name or "",
        "phone": row.phone,
        "center_name": row.center_name,
        "continue_url": row.continue_url,
        "source": row.source or "",
        "tags": list(row.tags or []),
        "status": row.status or "subscribed",
        "notes": row.notes,
        "mailchimp_synced_at": row.mailchimp_synced_at,
        "last_event_at": row.last_event_at,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "lists": lists,
        "list_ids": [item["id"] for item in lists],
    }


def _contact_with_lists(db: Session, contact_id: int) -> EmailListContact | None:
    return (
        db.query(EmailListContact)
        .options(joinedload(EmailListContact.memberships).joinedload(MailingListMember.mailing_list))
        .filter(EmailListContact.id == contact_id)
        .first()
    )


def assign_contact_to_list(
    db: Session,
    contact: EmailListContact,
    mailing_list: MailingList,
    *,
    commit: bool = True,
    sync: bool = True,
) -> MailingListMember:
    row = (
        db.query(MailingListMember)
        .filter(
            MailingListMember.list_id == mailing_list.id,
            MailingListMember.contact_id == contact.id,
        )
        .first()
    )
    if row is None:
        row = MailingListMember(list_id=mailing_list.id, contact_id=contact.id)
        db.add(row)
        db.flush()
    if commit:
        db.commit()
        db.refresh(row)
    if sync:
        sync_membership_to_mailchimp(db, row.id)
    return row


def remove_contact_from_list(db: Session, contact_id: int, list_id: int) -> bool:
    row = (
        db.query(MailingListMember)
        .filter(MailingListMember.list_id == list_id, MailingListMember.contact_id == contact_id)
        .first()
    )
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True


def set_contact_lists(db: Session, contact: EmailListContact, list_ids: list[int]) -> EmailListContact:
    wanted = {int(i) for i in list_ids if i}
    existing = {m.list_id: m for m in contact.memberships or []}
    for list_id, membership in list(existing.items()):
        if list_id not in wanted:
            db.delete(membership)
    for list_id in wanted:
        if list_id in existing:
            continue
        mailing_list = db.query(MailingList).filter(MailingList.id == list_id).first()
        if mailing_list is None:
            continue
        db.add(MailingListMember(list_id=mailing_list.id, contact_id=contact.id))
    db.commit()
    loaded = _contact_with_lists(db, contact.id)
    if loaded:
        for membership in loaded.memberships or []:
            sync_membership_to_mailchimp(db, membership.id)
        return loaded
    return contact


def assign_auto_lists(db: Session, contact: EmailListContact, source: str, *, commit: bool = True) -> None:
    if not source:
        return
    lists = db.query(MailingList).filter(MailingList.auto_sources.contains([source])).all()
    for mailing_list in lists:
        assign_contact_to_list(db, contact, mailing_list, commit=commit, sync=False)
    if commit:
        db.commit()


def sync_membership_to_mailchimp(db: Session | None, membership_id: int) -> bool:
    if db is None:
        return False
    membership = (
        db.query(MailingListMember)
        .options(
            joinedload(MailingListMember.mailing_list),
            joinedload(MailingListMember.contact),
        )
        .filter(MailingListMember.id == membership_id)
        .first()
    )
    if membership is None or membership.mailing_list is None or membership.contact is None:
        return False
    mailing_list = membership.mailing_list
    contact = membership.contact
    if contact.status == "unsubscribed":
        return False
    from app.services.mailchimp import cfg_for_mailing_list, push_mailchimp_member

    cfg = cfg_for_mailing_list(db, mailing_list)
    if not cfg["configured"]:
        return False
    tags = [t for t in (contact.tags or []) if t]
    list_tag = (mailing_list.mailchimp_tag or "").strip() or f"swa-{mailing_list.slug}"
    if list_tag not in tags:
        tags.append(list_tag)
    try:
        push_mailchimp_member(
            cfg,
            email=contact.email,
            name=contact.name or "",
            phone=contact.phone or "",
            center_name=contact.center_name or "",
            continue_url=contact.continue_url or "",
            source=contact.source or mailing_list.slug,
            tags=tags,
        )
        membership.mailchimp_synced_at = _now()
        contact.mailchimp_synced_at = _now()
        db.commit()
        return True
    except Exception:  # noqa: BLE001
        db.rollback()
        from logging import getLogger

        getLogger("swa").exception(
            "Mailchimp list sync failed list=%s email=%s", mailing_list.slug, contact.email
        )
        return False


def sync_contact_mailing_lists(db: Session | None, email: str) -> bool:
    if db is None:
        return False
    contact = (
        db.query(EmailListContact)
        .options(joinedload(EmailListContact.memberships))
        .filter(EmailListContact.email == (email or "").strip().lower())
        .first()
    )
    if contact is None:
        return False
    ok = False
    for membership in contact.memberships or []:
        if sync_membership_to_mailchimp(db, membership.id):
            ok = True
    return ok


def sync_mailing_list(db: Session, mailing_list: MailingList) -> dict[str, int]:
    members = (
        db.query(MailingListMember)
        .filter(MailingListMember.list_id == mailing_list.id)
        .all()
    )
    synced = 0
    failed = 0
    skipped = 0
    for membership in members:
        contact = db.query(EmailListContact).filter(EmailListContact.id == membership.contact_id).first()
        if contact is None or contact.status != "subscribed":
            skipped += 1
            continue
        if sync_membership_to_mailchimp(db, membership.id):
            synced += 1
        else:
            failed += 1
    return {"synced": synced, "failed": failed, "skipped": skipped, "total": len(members)}


def upsert_list_contact(
    db: Session | None,
    *,
    email: str,
    source: str,
    name: str = "",
    phone: str = "",
    center_name: str = "",
    continue_url: str = "",
    extra_tags: list[str] | None = None,
    notes: str | None = None,
    list_ids: list[int] | None = None,
    commit: bool = True,
) -> EmailListContact | None:
    """Upsert a local list member. Never raises to callers."""
    if db is None:
        return None
    email = (email or "").strip().lower()
    if not email or "@" not in email:
        return None
    tag = _source_tags().get(source)
    incoming_tags: list[str] = []
    if tag:
        incoming_tags.append(tag)
    for extra in extra_tags or []:
        extra = (extra or "").strip()
        if extra and extra not in incoming_tags:
            incoming_tags.append(extra)
    if source == "manual" and "swa-manual" not in incoming_tags:
        incoming_tags.append("swa-manual")

    try:
        ensure_system_lists(db)
        row = db.query(EmailListContact).filter(EmailListContact.email == email).first()
        if row is None:
            row = EmailListContact(
                email=email,
                name=(name or "").strip()[:255],
                phone=(phone or "").strip()[:50] or None,
                center_name=(center_name or "").strip()[:255] or None,
                continue_url=(continue_url or "").strip()[:512] or None,
                source=source or "manual",
                tags=incoming_tags,
                status="subscribed",
                notes=(notes or "").strip() or None,
                last_event_at=_now(),
            )
            db.add(row)
            db.flush()
        else:
            merged = list(row.tags or [])
            for item in incoming_tags:
                if item not in merged:
                    merged.append(item)
            row.tags = merged
            if source:
                row.source = source
            if (name or "").strip():
                row.name = name.strip()[:255]
            if (phone or "").strip():
                row.phone = phone.strip()[:50]
            if (center_name or "").strip():
                row.center_name = center_name.strip()[:255]
            if (continue_url or "").strip():
                row.continue_url = continue_url.strip()[:512]
            if notes is not None:
                row.notes = notes.strip() or None
            row.last_event_at = _now()
            db.flush()
        assign_auto_lists(db, row, source or "", commit=False)
        if list_ids:
            for list_id in list_ids:
                mailing_list = db.query(MailingList).filter(MailingList.id == int(list_id)).first()
                if mailing_list is None:
                    continue
                assign_contact_to_list(db, row, mailing_list, commit=False, sync=False)
        if commit:
            db.commit()
            db.refresh(row)
        return _contact_with_lists(db, row.id) or row
    except Exception:  # noqa: BLE001
        if commit:
            db.rollback()
        from logging import getLogger

        getLogger("swa").exception("Email list upsert failed for %s", email)
        return None


def mark_mailchimp_synced(db: Session | None, email: str) -> None:
    if db is None:
        return
    email = (email or "").strip().lower()
    if not email:
        return
    try:
        row = db.query(EmailListContact).filter(EmailListContact.email == email).first()
        if row is None:
            return
        row.mailchimp_synced_at = _now()
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()


def filtered_query(
    db: Session,
    *,
    q: str = "",
    source: str = "",
    status: str = "",
    tag: str = "",
    list_id: int | None = None,
):
    query = db.query(EmailListContact).options(
        joinedload(EmailListContact.memberships).joinedload(MailingListMember.mailing_list)
    )
    needle = (q or "").strip().lower()
    if needle:
        like = f"%{needle}%"
        query = query.filter(
            or_(
                func.lower(EmailListContact.email).like(like),
                func.lower(EmailListContact.name).like(like),
                func.lower(func.coalesce(EmailListContact.center_name, "")).like(like),
            )
        )
    if source:
        tag_for_source = _source_tags().get(source)
        if tag_for_source:
            query = query.filter(
                or_(
                    EmailListContact.source == source,
                    EmailListContact.tags.contains([tag_for_source]),
                )
            )
        else:
            query = query.filter(EmailListContact.source == source)
    if status in VALID_STATUSES:
        query = query.filter(EmailListContact.status == status)
    if tag:
        query = query.filter(EmailListContact.tags.contains([tag]))
    if list_id:
        member_ids = db.query(MailingListMember.contact_id).filter(MailingListMember.list_id == list_id)
        query = query.filter(EmailListContact.id.in_(member_ids))
    return query.order_by(
        EmailListContact.last_event_at.desc().nullslast(),
        EmailListContact.id.desc(),
    )


def source_counts(db: Session, list_id: int | None = None) -> dict[str, int]:
    query = db.query(func.count(EmailListContact.id))
    if list_id:
        member_ids = db.query(MailingListMember.contact_id).filter(MailingListMember.list_id == list_id)
        query = query.filter(EmailListContact.id.in_(member_ids))
    total = query.scalar() or 0
    counts = {"all": int(total)}
    for key, tag in _source_tags().items():
        q = db.query(func.count(EmailListContact.id)).filter(
            or_(
                EmailListContact.source == key,
                EmailListContact.tags.contains([tag]),
            )
        )
        if list_id:
            member_ids = db.query(MailingListMember.contact_id).filter(MailingListMember.list_id == list_id)
            q = q.filter(EmailListContact.id.in_(member_ids))
        counts[key] = int(q.scalar() or 0)
    manual_q = db.query(func.count(EmailListContact.id)).filter(
        or_(
            EmailListContact.source == "manual",
            EmailListContact.tags.contains(["swa-manual"]),
        )
    )
    if list_id:
        member_ids = db.query(MailingListMember.contact_id).filter(MailingListMember.list_id == list_id)
        manual_q = manual_q.filter(EmailListContact.id.in_(member_ids))
    counts["manual"] = int(manual_q.scalar() or 0)
    return counts


def list_mailing_lists(db: Session) -> list[dict[str, Any]]:
    ensure_system_lists(db)
    rows = db.query(MailingList).order_by(MailingList.is_system.desc(), MailingList.name.asc()).all()
    counts = dict(
        db.query(MailingListMember.list_id, func.count(MailingListMember.id))
        .group_by(MailingListMember.list_id)
        .all()
    )
    return [serialize_list(row, counts.get(row.id, 0)) for row in rows]


def rebuild_from_existing(db: Session) -> int:
    """Backfill contacts from registrations, claims, submissions, and abandonment leads."""
    ensure_system_lists(db)
    upserted = 0

    clients = (
        db.query(User)
        .options(joinedload(User.profile))
        .filter(User.role == UserRole.client)
        .all()
    )
    for user in clients:
        name = ""
        phone = ""
        if user.profile:
            name = user.profile.display_name or ""
            phone = user.profile.phone or ""
        if upsert_list_contact(
            db,
            email=user.email,
            source="registration",
            name=name,
            phone=phone,
            commit=True,
        ):
            upserted += 1

    claims = db.query(RehabCenterClaim).options(joinedload(RehabCenterClaim.center)).all()
    for claim in claims:
        center_name = claim.center.name if claim.center else ""
        if upsert_list_contact(
            db,
            email=claim.work_email,
            source="claim",
            name=claim.full_name or "",
            phone=claim.phone or "",
            center_name=center_name,
            extra_tags=["swa-registration"],
            commit=True,
        ):
            upserted += 1

    submissions = db.query(CenterSubmission).filter(CenterSubmission.email != "").all()
    for row in submissions:
        if upsert_list_contact(
            db,
            email=row.email,
            source="new_center",
            name=row.full_name or "",
            phone=row.phone or "",
            center_name=row.center_name or "",
            commit=True,
        ):
            upserted += 1

    leads = (
        db.query(CenterLead)
        .filter(
            or_(
                CenterLead.tag == "abandonment",
                CenterLead.source_kind.in_(("claim_abandonment", "submit_abandonment")),
            )
        )
        .all()
    )
    for lead in leads:
        source = "abandonment_claim"
        if lead.source_kind == "submit_abandonment":
            source = "abandonment_submit"
        if upsert_list_contact(
            db,
            email=lead.email,
            source=source,
            name=lead.full_name or "",
            phone=lead.phone or "",
            center_name=lead.center_name or "",
            continue_url=lead.source_url or "",
            commit=True,
        ):
            upserted += 1

    return upserted
