import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.deps import AdminUser
from app.core.security import create_action_token, hash_password
from app.database import get_db
from app.models.profile import UserProfile
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services.email import send_email

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])
settings = get_settings()


class AdminInviteRequest(BaseModel):
    email: EmailStr
    display_name: str = Field(default="", max_length=255)


class AdminInviteOut(BaseModel):
    user: UserOut
    email_sent: bool


def _active_admin_count(db: Session) -> int:
    return (
        db.query(User)
        .filter(User.role == UserRole.admin, User.is_active.is_(True))
        .count()
    )


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
        is_active=True if body.role == UserRole.admin else body.is_active,
    )
    db.add(user)
    db.flush()
    slug = body.display_name.lower().replace(" ", "-")[:40] if body.display_name else email.split("@")[0]
    db.add(UserProfile(user_id=user.id, display_name=body.display_name or email.split("@")[0], slug=f"{slug}-{user.id}"))
    db.commit()
    db.refresh(user)
    return user


@router.post("/invite-admin", response_model=AdminInviteOut, status_code=201)
def invite_admin(
    body: AdminInviteRequest,
    admin: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    """Create an active superadmin and email a one-time set-password link."""
    email = body.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    user = User(
        email=email,
        password_hash=hash_password(secrets.token_urlsafe(32)),
        role=UserRole.admin,
        is_active=True,
    )
    db.add(user)
    db.flush()
    display_name = body.display_name.strip() or email.split("@")[0]
    slug = display_name.lower().replace(" ", "-")[:40]
    db.add(UserProfile(user_id=user.id, display_name=display_name, slug=f"{slug}-{user.id}"))
    db.commit()
    db.refresh(user)

    token = create_action_token(email, "password_reset", expires_minutes=60 * 24)
    inviter_name = admin.profile.display_name if admin.profile else admin.email
    email_sent = send_email(
        db,
        to_email=email,
        template_key="admin_invite",
        context={
            "name": display_name,
            "invited_by": inviter_name,
            "reset_url": f"{settings.admin_site_url.rstrip('/')}/reset-password?token={token}",
            "login_url": f"{settings.admin_site_url.rstrip('/')}/swa-login/",
        },
        user_id=user.id,
        respect_preferences=False,
        meta={"invited_by_user_id": admin.id, "invited_by_email": admin.email},
    )
    return AdminInviteOut(user=UserOut.model_validate(user), email_sent=email_sent)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UserUpdate, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    next_role = body.role if body.role is not None else user.role
    next_active = body.is_active if body.is_active is not None else user.is_active
    if (
        user.role == UserRole.admin
        and user.is_active
        and (next_role != UserRole.admin or not next_active)
        and _active_admin_count(db) <= 1
    ):
        raise HTTPException(status_code=400, detail="Cannot deactivate or demote the last active superadmin")
    if body.email is not None:
        user.email = body.email.lower()
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    if user.role == UserRole.admin:
        user.is_active = True
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
    if user.role == UserRole.admin and user.is_active and _active_admin_count(db) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last active superadmin")
    db.delete(user)
    db.commit()
