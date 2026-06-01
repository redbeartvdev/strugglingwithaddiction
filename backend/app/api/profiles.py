from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.database import get_db
from app.models.profile import UserProfile
from app.schemas.profile import ProfileOut, ProfileUpdate
from app.services.storage import get_public_url, upload_file

router = APIRouter(prefix="/api/me", tags=["profile"])


def _profile_out(user, profile: UserProfile) -> ProfileOut:
    return ProfileOut(
        display_name=profile.display_name,
        slug=profile.slug,
        title=profile.title,
        bio=profile.bio,
        phone=profile.phone,
        address_line=profile.address_line,
        city=profile.city,
        state=profile.state,
        zip=profile.zip,
        country=profile.country,
        profile_photo_url=get_public_url(profile.profile_photo_key) if profile.profile_photo_key else None,
        social_links=profile.social_links or {},
        email=user.email,
        role=user.role.value,
    )


@router.get("/profile", response_model=ProfileOut)
def get_profile(user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not profile:
        profile = UserProfile(user_id=user.id, display_name=user.email.split("@")[0])
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return _profile_out(user, profile)


@router.patch("/profile", response_model=ProfileOut)
def update_profile(body: ProfileUpdate, user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        db.flush()
    data = body.model_dump(exclude_unset=True)
    if "social_links" in data and data["social_links"] is not None:
        data["social_links"] = data["social_links"].model_dump() if hasattr(data["social_links"], "model_dump") else data["social_links"]
    for k, v in data.items():
        setattr(profile, k, v)
    db.commit()
    db.refresh(profile)
    return _profile_out(user, profile)


@router.post("/profile/photo", response_model=ProfileOut)
async def upload_profile_photo(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
):
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Max 5MB")
    key = upload_file(content, file.filename or "photo.jpg", file.content_type or "image/jpeg")
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not profile:
        profile = UserProfile(user_id=user.id, display_name=user.email.split("@")[0])
        db.add(profile)
        db.flush()
    profile.profile_photo_key = key
    db.commit()
    db.refresh(profile)
    return _profile_out(user, profile)
