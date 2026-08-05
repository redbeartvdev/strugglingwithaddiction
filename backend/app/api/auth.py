from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.core.security import (
    create_action_token,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.profile import UserProfile
from app.models.user import User, UserRole
from app.schemas.auth import (
    ActionTokenRequest,
    ChangePasswordRequest,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshRequest,
    RegisterClientRequest,
    TokenResponse,
)
from app.config import get_settings
from app.services.email import send_email

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


def _authenticate(body: LoginRequest, db: Session) -> User:
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account not active. Complete subscription or contact admin.")
    return user


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.email, user.role.value),
        refresh_token=create_refresh_token(user.email),
        role=user.role.value,
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Annotated[Session, Depends(get_db)]):
    """Provider/editor login. Superadmins must use the dedicated endpoint."""
    user = _authenticate(body, db)
    if user.role == UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmins must sign in at /admin/swa-login/",
        )
    return _token_response(user)


@router.post("/admin-login", response_model=TokenResponse)
def admin_login(body: LoginRequest, db: Annotated[Session, Depends(get_db)]):
    """Dedicated superadmin login used only by /admin/swa-login/."""
    user = _authenticate(body, db)
    if user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This sign-in is restricted to superadmins",
        )
    return _token_response(user)


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
    send_email(
        db,
        to_email=user.email,
        template_key="password_changed",
        context={
            "name": user.profile.display_name if user.profile else user.email,
            "reset_url": f"{settings.admin_site_url}/reset-password",
            "support_email": settings.email_from,
        },
        user_id=user.id,
    )
    return {"message": "Password updated"}


@router.post("/request-password-reset")
def request_password_reset(body: PasswordResetRequest, db: Annotated[Session, Depends(get_db)]):
    """Always return the same answer to prevent account enumeration."""
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if user:
        token = create_action_token(user.email, "password_reset")
        send_email(
            db,
            to_email=user.email,
            template_key="password_reset",
            context={"name": user.profile.display_name if user.profile else user.email, "reset_url": f"{settings.admin_site_url}/reset-password?token={token}"},
            user_id=user.id,
        )
    return {"message": "If an account exists for that address, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(body: PasswordResetConfirm, db: Annotated[Session, Depends(get_db)]):
    payload = decode_token(body.token)
    if not payload or payload.get("type") != "action" or payload.get("action") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid or expired password-reset link")
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid password-reset link")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    send_email(
        db,
        to_email=user.email,
        template_key="password_changed",
        context={
            "name": user.profile.display_name if user.profile else user.email,
            "reset_url": f"{settings.admin_site_url}/reset-password",
            "support_email": settings.email_from,
        },
        user_id=user.id,
    )
    login_url = (
        f"{settings.admin_site_url.rstrip('/')}/swa-login/"
        if user.role == UserRole.admin
        else f"{settings.public_site_url.rstrip('/')}/portal"
    )
    return {"message": "Password updated. You can now sign in.", "login_url": login_url}


@router.post("/request-email-confirmation")
def request_email_confirmation(user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    token = create_action_token(user.email, "email_confirmation")
    send_email(
        db,
        to_email=user.email,
        template_key="email_confirmation",
        context={"name": user.profile.display_name if user.profile else user.email, "confirmation_url": f"{settings.admin_site_url}/confirm-email?token={token}"},
        user_id=user.id,
    )
    return {"message": "Confirmation email sent."}


@router.post("/confirm-email")
def confirm_email(body: ActionTokenRequest, db: Annotated[Session, Depends(get_db)]):
    payload = decode_token(body.token)
    if not payload or payload.get("type") != "action" or payload.get("action") != "email_confirmation":
        raise HTTPException(status_code=400, detail="Invalid or expired confirmation link")
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid confirmation link")
    from datetime import datetime, timezone
    user.email_verified_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Email confirmed."}


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
    send_email(
        db,
        to_email=user.email,
        template_key="account_created",
        context={
            "name": body.display_name,
            "email": user.email,
            "login_url": f"{settings.public_site_url.rstrip('/')}/portal",
            "claim_for": "",
        },
        user_id=user.id,
    )
    return {"user_id": user.id, "message": "Registered. Complete checkout to activate."}
