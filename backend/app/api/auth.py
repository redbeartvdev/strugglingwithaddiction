from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.profile import UserProfile
from app.models.user import User, UserRole
from app.schemas.auth import ChangePasswordRequest, LoginRequest, RefreshRequest, RegisterClientRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active and user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account not active. Complete subscription or contact admin.")
    return TokenResponse(
        access_token=create_access_token(user.email, user.role.value),
        refresh_token=create_refresh_token(user.email),
        role=user.role.value,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Annotated[Session, Depends(get_db)]):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    email = payload.get("sub")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return TokenResponse(
        access_token=create_access_token(user.email, user.role.value),
        refresh_token=create_refresh_token(user.email),
        role=user.role.value,
    )


@router.post("/change-password")
def change_password(body: ChangePasswordRequest, user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    if user.role == UserRole.admin:
        pass
    elif user.role not in (UserRole.editor, UserRole.client):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Password updated"}


@router.post("/register-client")
def register_client(body: RegisterClientRequest, db: Annotated[Session, Depends(get_db)]):
    email = body.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    user = User(
        email=email,
        password_hash=hash_password(body.password),
        role=UserRole.client,
        is_active=False,
    )
    db.add(user)
    db.flush()
    slug_base = body.display_name.lower().replace(" ", "-")[:50]
    db.add(UserProfile(user_id=user.id, display_name=body.display_name, slug=f"{slug_base}-{user.id}"))
    db.commit()
    return {"user_id": user.id, "message": "Registered. Complete checkout to activate."}
