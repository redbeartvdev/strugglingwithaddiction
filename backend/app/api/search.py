from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.deps import CurrentUser
from app.database import get_db
from app.models.blog import Post
from app.models.client_portal import ClientPost
from app.models.profile import UserProfile
from app.models.rehab import RehabCenter, RehabCenterClaim
from app.models.user import User, UserRole
from app.schemas.search import SearchHit, SearchOut

router = APIRouter(tags=["search"])


def _add_hits(hits: list[SearchHit], seen: set[str], item: SearchHit) -> None:
    key = f"{item.type}:{item.id}"
    if key in seen:
        return
    seen.add(key)
    hits.append(item)


@router.get("/api/search", response_model=SearchOut)
def global_search(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    q: str = Query(..., min_length=1, max_length=100),
):
    term = f"%{q.strip()}%"
    hits: list[SearchHit] = []
    seen: set[str] = set()

    if user.role in (UserRole.admin, UserRole.editor):
        posts = (
            db.query(Post)
            .filter(Post.deleted_at.is_(None), or_(Post.title.ilike(term), Post.slug.ilike(term)))
            .order_by(Post.updated_at.desc())
            .limit(8)
            .all()
        )
        for p in posts:
            _add_hits(
                hits,
                seen,
                SearchHit(type="post", id=p.id, label=p.title, meta=p.slug),
            )

    if user.role == UserRole.admin:
        centers = (
            db.query(RehabCenter)
            .filter(
                RehabCenter.deleted_at.is_(None),
                or_(
                    RehabCenter.name.ilike(term),
                    RehabCenter.location_display.ilike(term),
                    RehabCenter.slug.ilike(term),
                    RehabCenter.city.ilike(term),
                    RehabCenter.state.ilike(term),
                ),
            )
            .order_by(RehabCenter.name)
            .limit(8)
            .all()
        )
        for c in centers:
            _add_hits(
                hits,
                seen,
                SearchHit(
                    type="center",
                    id=c.id,
                    label=c.name,
                    meta=c.location_display or c.slug,
                ),
            )

        users = (
            db.query(User)
            .outerjoin(UserProfile, UserProfile.user_id == User.id)
            .filter(
                or_(
                    User.email.ilike(term),
                    UserProfile.display_name.ilike(term),
                )
            )
            .order_by(User.email)
            .limit(8)
            .all()
        )
        for u in users:
            profile = db.query(UserProfile).filter(UserProfile.user_id == u.id).first()
            _add_hits(
                hits,
                seen,
                SearchHit(
                    type="user",
                    id=u.id,
                    label=profile.display_name if profile else u.email,
                    meta=f"{u.email} · {u.role.value}",
                ),
            )

        claims = (
            db.query(RehabCenterClaim)
            .options(joinedload(RehabCenterClaim.center))
            .filter(
                or_(
                    RehabCenterClaim.ticket_number.ilike(term),
                    RehabCenterClaim.full_name.ilike(term),
                    RehabCenterClaim.work_email.ilike(term),
                    RehabCenterClaim.center.has(RehabCenter.name.ilike(term)),
                )
            )
            .order_by(RehabCenterClaim.created_at.desc())
            .limit(6)
            .all()
        )
        for c in claims:
            _add_hits(
                hits,
                seen,
                SearchHit(
                    type="claim",
                    id=c.id,
                    label=c.ticket_number,
                    meta=f"{c.center.name} · {c.full_name}",
                ),
            )

    if user.role == UserRole.client:
        client_posts = (
            db.query(ClientPost)
            .filter(
                ClientPost.user_id == user.id,
                or_(ClientPost.title.ilike(term), ClientPost.slug.ilike(term)),
            )
            .order_by(ClientPost.updated_at.desc())
            .limit(8)
            .all()
        )
        for p in client_posts:
            _add_hits(
                hits,
                seen,
                SearchHit(type="post", id=p.id, label=p.title, meta=p.slug),
            )

    return SearchOut(q=q.strip(), results=hits[:20])
