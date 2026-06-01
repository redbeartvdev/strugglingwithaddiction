from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import ClientUser
from app.core.html import sanitize_html
from app.database import get_db
from app.models.client_portal import ClientLandingPage, ClientPost, ClientPostStatus
from app.models.profile import UserProfile
from app.schemas.client_portal import (
    ClientPostCreate,
    ClientPostOut,
    ClientPostPublic,
    ClientPostUpdate,
    LandingPageOut,
    LandingPageUpdate,
)
from app.services.storage import get_public_url, resolve_image_url

router = APIRouter(tags=["client-portal"])


@router.get("/api/client/landing", response_model=LandingPageOut)
def get_landing(user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    page = db.query(ClientLandingPage).filter(ClientLandingPage.user_id == user.id).first()
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not page:
        page = ClientLandingPage(user_id=user.id, headline=profile.display_name if profile else "")
        db.add(page)
        db.commit()
        db.refresh(page)
    return LandingPageOut(
        headline=page.headline,
        about_html=page.about_html,
        hero_image_url=get_public_url(page.hero_image_key) if page.hero_image_key else None,
        is_published=page.is_published,
        meta_title=page.meta_title,
        meta_description=page.meta_description,
        slug=profile.slug if profile else None,
        display_name=profile.display_name if profile else None,
    )


@router.patch("/api/client/landing", response_model=LandingPageOut)
def update_landing(body: LandingPageUpdate, user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    page = db.query(ClientLandingPage).filter(ClientLandingPage.user_id == user.id).first()
    if not page:
        page = ClientLandingPage(user_id=user.id)
        db.add(page)
        db.flush()
    data = body.model_dump(exclude_unset=True)
    if "about_html" in data:
        data["about_html"] = sanitize_html(data["about_html"])
    for k, v in data.items():
        setattr(page, k, v)
    db.commit()
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    return LandingPageOut(
        headline=page.headline,
        about_html=page.about_html,
        hero_image_url=get_public_url(page.hero_image_key) if page.hero_image_key else None,
        is_published=page.is_published,
        meta_title=page.meta_title,
        meta_description=page.meta_description,
        slug=profile.slug if profile else None,
        display_name=profile.display_name if profile else None,
    )


@router.get("/api/client/posts", response_model=list[ClientPostOut])
def list_client_posts(user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    return db.query(ClientPost).filter(ClientPost.user_id == user.id).order_by(ClientPost.updated_at.desc()).all()


@router.post("/api/client/posts", response_model=ClientPostOut, status_code=201)
def create_client_post(body: ClientPostCreate, user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    if db.query(ClientPost).filter(ClientPost.user_id == user.id, ClientPost.slug == body.slug).first():
        raise HTTPException(status_code=400, detail="Slug exists")
    post = ClientPost(
        user_id=user.id,
        slug=body.slug,
        title=body.title,
        excerpt=body.excerpt,
        content_html=sanitize_html(body.content_html),
        status=body.status,
    )
    if body.status == ClientPostStatus.published:
        post.published_at = datetime.now(timezone.utc)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.patch("/api/client/posts/{post_id}", response_model=ClientPostOut)
def update_client_post(post_id: int, body: ClientPostUpdate, user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    post = db.query(ClientPost).filter(ClientPost.id == post_id, ClientPost.user_id == user.id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    data = body.model_dump(exclude_unset=True)
    if "content_html" in data:
        data["content_html"] = sanitize_html(data["content_html"])
    if data.get("status") == ClientPostStatus.published and not post.published_at:
        post.published_at = datetime.now(timezone.utc)
    for k, v in data.items():
        setattr(post, k, v)
    db.commit()
    db.refresh(post)
    return post


@router.delete("/api/client/posts/{post_id}", status_code=204)
def delete_client_post(post_id: int, user: ClientUser, db: Annotated[Session, Depends(get_db)]):
    post = db.query(ClientPost).filter(ClientPost.id == post_id, ClientPost.user_id == user.id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()


@router.get("/api/partners/{slug}", response_model=LandingPageOut)
def public_landing(slug: str, db: Annotated[Session, Depends(get_db)]):
    profile = db.query(UserProfile).filter(UserProfile.slug == slug).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Not found")
    page = db.query(ClientLandingPage).filter(ClientLandingPage.user_id == profile.user_id, ClientLandingPage.is_published.is_(True)).first()
    if not page:
        raise HTTPException(status_code=404, detail="Not found")
    return LandingPageOut(
        headline=page.headline,
        about_html=page.about_html,
        hero_image_url=get_public_url(page.hero_image_key) if page.hero_image_key else None,
        is_published=page.is_published,
        meta_title=page.meta_title,
        meta_description=page.meta_description,
        slug=profile.slug,
        display_name=profile.display_name,
    )


@router.get("/api/partners/{slug}/posts", response_model=list[ClientPostPublic])
def public_client_posts(slug: str, db: Annotated[Session, Depends(get_db)]):
    profile = db.query(UserProfile).filter(UserProfile.slug == slug).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Not found")
    posts = (
        db.query(ClientPost)
        .filter(ClientPost.user_id == profile.user_id, ClientPost.status == ClientPostStatus.published)
        .order_by(ClientPost.published_at.desc())
        .all()
    )
    return [
        ClientPostPublic(
            slug=p.slug,
            title=p.title,
            excerpt=p.excerpt,
            content=p.content_html,
            published_at=p.published_at.isoformat() if p.published_at else None,
        )
        for p in posts
    ]
