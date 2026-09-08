"""Service-code catalog — public list and admin management."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import AdminUser
from app.database import get_db
from app.models.service_code import ServiceCodeCatalog
from app.schemas.service_code import (
    ServiceCodeCategory,
    ServiceCodeCreate,
    ServiceCodeOut,
    ServiceCodeSeedResult,
    ServiceCodeUpdate,
)
from app.services.service_codes import group_catalog, seed_service_code_catalog

router = APIRouter(tags=["service-codes"])


class ServiceCodeBulkBody(BaseModel):
    enabled: bool
    ids: list[int] | None = None


@router.get("/api/service-codes", response_model=list[ServiceCodeOut])
def list_enabled_service_codes(db: Annotated[Session, Depends(get_db)]):
    rows = (
        db.query(ServiceCodeCatalog)
        .filter(ServiceCodeCatalog.enabled.is_(True))
        .order_by(ServiceCodeCatalog.sort_order.asc(), ServiceCodeCatalog.service_name.asc())
        .all()
    )
    return [ServiceCodeOut.model_validate(row) for row in rows]


@router.get("/api/service-codes/grouped", response_model=list[ServiceCodeCategory])
def list_enabled_service_codes_grouped(db: Annotated[Session, Depends(get_db)]):
    rows = (
        db.query(ServiceCodeCatalog)
        .filter(ServiceCodeCatalog.enabled.is_(True))
        .order_by(ServiceCodeCatalog.sort_order.asc(), ServiceCodeCatalog.service_name.asc())
        .all()
    )
    return group_catalog(rows)


@router.get("/api/admin/service-codes", response_model=list[ServiceCodeOut])
def list_admin_service_codes(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    rows = (
        db.query(ServiceCodeCatalog)
        .order_by(ServiceCodeCatalog.sort_order.asc(), ServiceCodeCatalog.service_name.asc())
        .all()
    )
    return [ServiceCodeOut.model_validate(row) for row in rows]


@router.post("/api/admin/service-codes", response_model=ServiceCodeOut, status_code=201)
def create_service_code(body: ServiceCodeCreate, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    code = body.service_code.strip()
    if db.query(ServiceCodeCatalog).filter(ServiceCodeCatalog.service_code == code).first():
        raise HTTPException(status_code=400, detail="Service code already exists")
    sort_order = body.sort_order
    if sort_order is None:
        last = db.query(ServiceCodeCatalog).order_by(ServiceCodeCatalog.sort_order.desc()).first()
        sort_order = (last.sort_order + 1) if last else 0
    row = ServiceCodeCatalog(
        category_code=body.category_code.strip().upper(),
        category_name=body.category_name.strip(),
        service_code=code,
        service_name=body.service_name.strip(),
        service_description=(body.service_description or "").strip(),
        enabled=body.enabled,
        sort_order=sort_order,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ServiceCodeOut.model_validate(row)


@router.patch("/api/admin/service-codes/{code_id}", response_model=ServiceCodeOut)
def update_service_code(
    code_id: int,
    body: ServiceCodeUpdate,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    row = db.query(ServiceCodeCatalog).filter(ServiceCodeCatalog.id == code_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Service code not found")
    data = body.model_dump(exclude_unset=True)
    if "service_code" in data:
        next_code = (data["service_code"] or "").strip()
        if not next_code:
            raise HTTPException(status_code=400, detail="Service code is required")
        clash = (
            db.query(ServiceCodeCatalog)
            .filter(ServiceCodeCatalog.service_code == next_code, ServiceCodeCatalog.id != code_id)
            .first()
        )
        if clash:
            raise HTTPException(status_code=400, detail="Service code already exists")
        data["service_code"] = next_code
    if "category_code" in data and data["category_code"] is not None:
        data["category_code"] = data["category_code"].strip().upper()
    for key in ("category_name", "service_name", "service_description"):
        if key in data and isinstance(data[key], str):
            data[key] = data[key].strip()
    for key, value in data.items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return ServiceCodeOut.model_validate(row)


@router.delete("/api/admin/service-codes/{code_id}", status_code=204)
def delete_service_code(code_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    row = db.query(ServiceCodeCatalog).filter(ServiceCodeCatalog.id == code_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Service code not found")
    db.delete(row)
    db.commit()


@router.post("/api/admin/service-codes/bulk")
def bulk_toggle_service_codes(body: ServiceCodeBulkBody, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    query = db.query(ServiceCodeCatalog)
    if body.ids:
        query = query.filter(ServiceCodeCatalog.id.in_(body.ids))
    updated = query.update({ServiceCodeCatalog.enabled: body.enabled}, synchronize_session=False)
    db.commit()
    return {"updated": updated, "enabled": body.enabled}


@router.post("/api/admin/service-codes/seed", response_model=ServiceCodeSeedResult)
def reseed_service_codes(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    return seed_service_code_catalog(db)
