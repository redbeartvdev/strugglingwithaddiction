from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import AdminUser, get_db
from app.models.directory_page import DirectoryPage, DirectoryPageStatus, DirectoryPageType
from app.schemas.directory import (
    DirectoryPageAdmin,
    DirectoryPageCreate,
    DirectoryPagePublic,
    DirectoryPageUpdate,
    FaqItem,
)

router = APIRouter(tags=["directory"])


def _page_to_public(page: DirectoryPage) -> DirectoryPagePublic:
    faq_raw = page.faq_json or []
    faq = [FaqItem(**item) for item in faq_raw if isinstance(item, dict) and item.get("question")]
    return DirectoryPagePublic(
        page_type=page.page_type,
        state_slug=page.state_slug,
        city_slug=page.city_slug,
        title=page.title,
        body_html=page.body_html,
        faq=faq,
        meta_title=page.meta_title,
        meta_description=page.meta_description,
        filter_state=page.filter_state,
        filter_city=page.filter_city,
        filter_insurance=page.filter_insurance,
    )


def _get_published_page(
    db: Session,
    state_slug: str,
    city_slug: str | None = None,
) -> DirectoryPage:
    q = db.query(DirectoryPage).filter(
        DirectoryPage.state_slug == state_slug.lower(),
        DirectoryPage.status == DirectoryPageStatus.published,
        DirectoryPage.deleted_at.is_(None),
    )
    if city_slug:
        q = q.filter(
            DirectoryPage.city_slug == city_slug.lower(),
            DirectoryPage.page_type == DirectoryPageType.city,
        )
    else:
        q = q.filter(
            DirectoryPage.city_slug.is_(None),
            DirectoryPage.page_type == DirectoryPageType.state,
        )
    page = q.first()
    if not page:
        raise HTTPException(status_code=404, detail="Directory page not found")
    return page


@router.get("/api/directory/states", response_model=list[DirectoryPagePublic])
def list_state_pages(db: Annotated[Session, Depends(get_db)]):
    pages = (
        db.query(DirectoryPage)
        .filter(
            DirectoryPage.page_type == DirectoryPageType.state,
            DirectoryPage.status == DirectoryPageStatus.published,
            DirectoryPage.deleted_at.is_(None),
        )
        .order_by(DirectoryPage.title)
        .all()
    )
    return [_page_to_public(p) for p in pages]


@router.get("/api/directory/states/{state_slug}", response_model=DirectoryPagePublic)
def get_state_page(state_slug: str, db: Annotated[Session, Depends(get_db)]):
    return _page_to_public(_get_published_page(db, state_slug))


@router.get("/api/directory/states/{state_slug}/cities/{city_slug}", response_model=DirectoryPagePublic)
def get_city_page(state_slug: str, city_slug: str, db: Annotated[Session, Depends(get_db)]):
    return _page_to_public(_get_published_page(db, state_slug, city_slug))


@router.get("/api/admin/directory-pages", response_model=list[DirectoryPageAdmin])
def admin_list_pages(admin: AdminUser, db: Annotated[Session, Depends(get_db)]):
    pages = (
        db.query(DirectoryPage)
        .filter(DirectoryPage.deleted_at.is_(None))
        .order_by(DirectoryPage.state_slug, DirectoryPage.city_slug)
        .all()
    )
    return pages


@router.get("/api/admin/directory-pages/{page_id}", response_model=DirectoryPageAdmin)
def admin_get_page(page_id: int, admin: AdminUser, db: Annotated[Session, Depends(get_db)]):
    page = db.query(DirectoryPage).filter(DirectoryPage.id == page_id, DirectoryPage.deleted_at.is_(None)).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


@router.post("/api/admin/directory-pages", response_model=DirectoryPageAdmin)
def admin_create_page(body: DirectoryPageCreate, admin: AdminUser, db: Annotated[Session, Depends(get_db)]):
    page = DirectoryPage(
        page_type=body.page_type,
        status=body.status,
        state_slug=body.state_slug.lower().strip(),
        city_slug=body.city_slug.lower().strip() if body.city_slug else None,
        title=body.title,
        body_html=body.body_html,
        faq_json=body.faq_json,
        meta_title=body.meta_title,
        meta_description=body.meta_description,
        filter_state=body.filter_state,
        filter_city=body.filter_city,
        filter_insurance=body.filter_insurance,
        published_at=body.published_at,
    )
    if body.status == DirectoryPageStatus.published and not page.published_at:
        page.published_at = datetime.now(timezone.utc)
    db.add(page)
    db.commit()
    db.refresh(page)
    return page


@router.patch("/api/admin/directory-pages/{page_id}", response_model=DirectoryPageAdmin)
def admin_update_page(
    page_id: int,
    body: DirectoryPageUpdate,
    admin: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    page = db.query(DirectoryPage).filter(DirectoryPage.id == page_id, DirectoryPage.deleted_at.is_(None)).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    data = body.model_dump(exclude_unset=True)
    if "state_slug" in data and data["state_slug"]:
        data["state_slug"] = data["state_slug"].lower().strip()
    if "city_slug" in data and data["city_slug"]:
        data["city_slug"] = data["city_slug"].lower().strip()
    for key, val in data.items():
        setattr(page, key, val)
    if body.status == DirectoryPageStatus.published and not page.published_at:
        page.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(page)
    return page


@router.delete("/api/admin/directory-pages/{page_id}", status_code=204)
def admin_delete_page(page_id: int, admin: AdminUser, db: Annotated[Session, Depends(get_db)]):
    page = db.query(DirectoryPage).filter(DirectoryPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page.deleted_at = datetime.now(timezone.utc)
    db.commit()
