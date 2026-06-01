from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import AdminUser
from app.core.security import hash_password
from app.database import get_db
from app.models.profile import UserProfile
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


@router.get("", response_model=list[UserOut])
def list_users(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    return db.query(User).order_by(User.id).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    email = body.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email exists")
    user = User(
        email=email,
        password_hash=hash_password(body.password),
        role=body.role,
        is_active=body.is_active,
    )
    db.add(user)
    db.flush()
    slug = body.display_name.lower().replace(" ", "-")[:40] if body.display_name else email.split("@")[0]
    db.add(UserProfile(user_id=user.id, display_name=body.display_name or email.split("@")[0], slug=f"{slug}-{user.id}"))
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UserUpdate, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.email is not None:
        user.email = body.email.lower()
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.password:
        user.password_hash = hash_password(body.password)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, admin: AdminUser, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db.delete(user)
    db.commit()
