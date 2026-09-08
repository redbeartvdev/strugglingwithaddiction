"""Admin CRUD for named mailing lists, contacts, CSV export, and Mailchimp sync."""
from __future__ import annotations

import csv
import io
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.deps import AdminUser
from app.database import get_db
from app.models.email_list import EmailListContact, MailingList
from app.schemas.email_list import (
    EmailListContactCreate,
    EmailListContactOut,
    EmailListContactUpdate,
    EmailListPage,
    EmailListRebuildOut,
    MailingListCreate,
    MailingListMembersIn,
    MailingListOut,
    MailingListSyncOut,
    MailingListUpdate,
)
from app.services.email_list import (
    VALID_STATUSES,
    assign_contact_to_list,
    filtered_query,
    list_mailing_lists,
    rebuild_from_existing,
    remove_contact_from_list,
    serialize_contact,
    serialize_list,
    set_contact_lists,
    source_counts,
    sync_contact_mailing_lists,
    sync_mailing_list,
    unique_slug,
    upsert_list_contact,
)
from app.services.mailchimp import cfg_for_mailing_list, ping_audience

router = APIRouter(tags=["email-list"])


def _get_list(db: Session, list_id: int) -> MailingList:
    row = db.query(MailingList).filter(MailingList.id == list_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="List not found")
    return row


@router.get("/api/admin/mailing-lists", response_model=list[MailingListOut])
def admin_list_mailing_lists(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    return list_mailing_lists(db)


@router.post("/api/admin/mailing-lists", response_model=MailingListOut)
def admin_create_mailing_list(
    body: MailingListCreate,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="List name is required")
    row = MailingList(
        name=name[:255],
        slug=unique_slug(db, name),
        description=(body.description or "").strip(),
        auto_sources=list(body.auto_sources or []),
        is_system=False,
        mailchimp_enabled=bool(body.mailchimp_enabled),
        mailchimp_audience_id=(body.mailchimp_audience_id or "").strip() or None,
        mailchimp_tag=(body.mailchimp_tag or "").strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return serialize_list(row, 0)


@router.patch("/api/admin/mailing-lists/{list_id}", response_model=MailingListOut)
def admin_update_mailing_list(
    list_id: int,
    body: MailingListUpdate,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    row = _get_list(db, list_id)
    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="List name is required")
        row.name = name[:255]
        if not row.is_system:
            row.slug = unique_slug(db, name, exclude_id=row.id)
    if "description" in data:
        row.description = (data["description"] or "").strip()
    if "auto_sources" in data:
        row.auto_sources = list(data["auto_sources"] or [])
    if "mailchimp_enabled" in data:
        row.mailchimp_enabled = bool(data["mailchimp_enabled"])
    if "mailchimp_audience_id" in data:
        row.mailchimp_audience_id = (data["mailchimp_audience_id"] or "").strip() or None
    if "mailchimp_tag" in data:
        row.mailchimp_tag = (data["mailchimp_tag"] or "").strip() or None
    db.commit()
    db.refresh(row)
    counts = {item["id"]: item["member_count"] for item in list_mailing_lists(db)}
    return serialize_list(row, counts.get(row.id, 0))


@router.delete("/api/admin/mailing-lists/{list_id}")
def admin_delete_mailing_list(list_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    row = _get_list(db, list_id)
    if row.is_system:
        raise HTTPException(status_code=400, detail="System lists cannot be deleted")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.post("/api/admin/mailing-lists/{list_id}/members")
def admin_add_list_members(
    list_id: int,
    body: MailingListMembersIn,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    mailing_list = _get_list(db, list_id)
    added = 0
    contact_ids = list(body.contact_ids or [])
    for email in body.emails or []:
        row = upsert_list_contact(db, email=str(email), source="manual", list_ids=[list_id])
        if row is not None:
            added += 1
            if row.id not in contact_ids:
                contact_ids.append(row.id)
    for contact_id in contact_ids:
        contact = db.query(EmailListContact).filter(EmailListContact.id == contact_id).first()
        if contact is None:
            continue
        assign_contact_to_list(db, contact, mailing_list, commit=True, sync=True)
        added += 1
    return {"added": added, "list": serialize_list(mailing_list)}


@router.delete("/api/admin/mailing-lists/{list_id}/members/{contact_id}")
def admin_remove_list_member(
    list_id: int,
    contact_id: int,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    _get_list(db, list_id)
    if not remove_contact_from_list(db, contact_id, list_id):
        raise HTTPException(status_code=404, detail="Contact is not on this list")
    return {"ok": True}


@router.post("/api/admin/mailing-lists/{list_id}/ping")
def admin_ping_list_mailchimp(list_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    mailing_list = _get_list(db, list_id)
    cfg = cfg_for_mailing_list(db, mailing_list)
    try:
        return ping_audience(db, cfg.get("audience_id") or None)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)[:400]) from exc


@router.post("/api/admin/mailing-lists/{list_id}/sync", response_model=MailingListSyncOut)
def admin_sync_mailing_list(list_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    mailing_list = _get_list(db, list_id)
    if not mailing_list.mailchimp_enabled:
        raise HTTPException(status_code=400, detail="Enable Mailchimp on this list first")
    cfg = cfg_for_mailing_list(db, mailing_list)
    if not cfg["configured"]:
        raise HTTPException(status_code=400, detail="Mailchimp API key and audience ID are required")
    return sync_mailing_list(db, mailing_list)


@router.get("/api/admin/email-list", response_model=EmailListPage)
def list_email_contacts(
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
    q: str = "",
    source: str = "",
    status: str = "",
    tag: str = "",
    list_id: int | None = None,
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
):
    query = filtered_query(db, q=q, source=source, status=status, tag=tag, list_id=list_id)
    total = query.count()
    rows = query.offset(offset).limit(limit).all()
    return {
        "total": total,
        "counts": source_counts(db, list_id=list_id),
        "items": [serialize_contact(row) for row in rows],
        "lists": list_mailing_lists(db),
    }


@router.get("/api/admin/email-list/export")
def export_email_list(
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
    q: str = "",
    source: str = "",
    status: str = "",
    tag: str = "",
    list_id: int | None = None,
):
    rows = filtered_query(db, q=q, source=source, status=status, tag=tag, list_id=list_id).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "email",
        "first_name",
        "last_name",
        "name",
        "phone",
        "center_name",
        "source",
        "tags",
        "lists",
        "status",
        "continue_url",
        "mailchimp_synced_at",
        "last_event_at",
        "created_at",
    ])
    for row in rows:
        parts = (row.name or "").strip().split()
        first = parts[0] if parts else ""
        last = " ".join(parts[1:]) if len(parts) > 1 else ""
        list_names = []
        for membership in row.memberships or []:
            if membership.mailing_list:
                list_names.append(membership.mailing_list.name)
        writer.writerow([
            row.email,
            first,
            last,
            row.name or "",
            row.phone or "",
            row.center_name or "",
            row.source or "",
            ",".join(row.tags or []),
            ",".join(list_names),
            row.status or "",
            row.continue_url or "",
            row.mailchimp_synced_at.isoformat() if row.mailchimp_synced_at else "",
            row.last_event_at.isoformat() if row.last_event_at else "",
            row.created_at.isoformat() if row.created_at else "",
        ])
    filename = "swa-email-list.csv"
    if list_id:
        mailing_list = db.query(MailingList).filter(MailingList.id == list_id).first()
        if mailing_list:
            filename = f"swa-email-list-{mailing_list.slug}.csv"
    elif source:
        filename = f"swa-email-list-{source}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/api/admin/email-list", response_model=EmailListContactOut)
def add_email_contact(
    body: EmailListContactCreate,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    source = (body.source or "manual").strip() or "manual"
    row = upsert_list_contact(
        db,
        email=str(body.email),
        source=source,
        name=body.name or "",
        phone=body.phone or "",
        center_name=body.center_name or "",
        notes=body.notes,
        list_ids=list(body.list_ids or []),
        extra_tags=["swa-manual"] if source == "manual" else None,
    )
    if row is None:
        raise HTTPException(status_code=400, detail="Could not save that email")
    sync_contact_mailing_lists(db, row.email)
    return serialize_contact(row)


@router.post("/api/admin/email-list/rebuild", response_model=EmailListRebuildOut)
def rebuild_email_list(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    upserted = rebuild_from_existing(db)
    total = db.query(EmailListContact).count()
    return {"upserted": upserted, "total": total}


@router.patch("/api/admin/email-list/{contact_id}", response_model=EmailListContactOut)
def update_email_contact(
    contact_id: int,
    body: EmailListContactUpdate,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    row = db.query(EmailListContact).filter(EmailListContact.id == contact_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Contact not found")
    data = body.model_dump(exclude_unset=True)
    list_ids = data.pop("list_ids", None)
    if "status" in data and data["status"] not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Status must be subscribed or unsubscribed")
    for key, value in data.items():
        setattr(row, key, value)
    db.commit()
    if list_ids is not None:
        row = set_contact_lists(db, row, list_ids)
    else:
        from sqlalchemy.orm import joinedload
        from app.models.email_list import MailingListMember

        row = (
            db.query(EmailListContact)
            .options(joinedload(EmailListContact.memberships).joinedload(MailingListMember.mailing_list))
            .filter(EmailListContact.id == contact_id)
            .first()
        )
    return serialize_contact(row)


@router.delete("/api/admin/email-list/{contact_id}")
def delete_email_contact(
    contact_id: int,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    row = db.query(EmailListContact).filter(EmailListContact.id == contact_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
