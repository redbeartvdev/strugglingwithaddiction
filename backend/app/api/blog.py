from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.api.blog_helpers import post_to_detail, post_to_list_item
from app.core.deps import AdminUser, CurrentUser, EditorUser
from app.core.html import sanitize_html
from app.core.security import hash_password, verify_password
from app.database import get_db
from app.models.blog import Author, Category, Post, PostStatus
from app.models.user import UserRole
from app.schemas.blog import (
    AuthorOut,
    BlogSettingsOut,
    BlogSettingsUpdate,
    CategoryOut,
    PostAdminOut,
    PostCreate,
    PostDetail,
    PostListItem,
    PostUpdate,
)
from app.services.storage import get_public_url, resolve_image_url, upload_file
from app.services.trash import get_blog_settings, purge_expired_trash

router = APIRouter(tags=["blog"])


def _published_query(db: Session):
    return (
        db.query(Post)
        .options(joinedload(Post.categories), joinedload(Post.author))
        .filter(Post.status == PostStatus.published, Post.deleted_at.is_(None))
        .order_by(Post.published_at.desc())
    )


def _active_posts_query(db: Session):
    return db.query(Post).options(joinedload(Post.categories)).filter(Post.deleted_at.is_(None))


def _trash_posts_query(db: Session):
    return db.query(Post).options(joinedload(Post.categories)).filter(Post.deleted_at.isnot(None))


@router.get("/api/posts", response_model=list[PostListItem])
def list_posts(
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=100),
    category: str | None = None,
    search: str | None = None,
    limit: int | None = None,
):
    q = _published_query(db)
    if category:
        q = q.join(Post.categories).filter(Category.slug == category)
    if search:
        term = f"%{search.lower()}%"
        q = q.filter(Post.title.ilike(term) | Post.excerpt.ilike(term))
    if limit:
        posts = q.limit(limit).all()
    else:
        posts = q.offset((page - 1) * per_page).limit(per_page).all()
    return [post_to_list_item(p) for p in posts]


@router.get("/api/posts/{slug}", response_model=PostDetail)
def get_post(
    slug: str,
    db: Annotated[Session, Depends(get_db)],
    password: str | None = Query(None),
):
    post = (
        db.query(Post)
        .options(joinedload(Post.categories), joinedload(Post.author))
        .filter(Post.slug == slug, Post.deleted_at.is_(None))
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.status == PostStatus.draft or post.status == PostStatus.archived:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.status == PostStatus.private:
        if not post.visibility_password_hash:
            raise HTTPException(status_code=404, detail="Post not found")
        if not password or not verify_password(password, post.visibility_password_hash):
            raise HTTPException(status_code=403, detail="Password required")
        return post_to_detail(post)
    if post.status == PostStatus.published:
        return post_to_detail(post)
    raise HTTPException(status_code=404, detail="Post not found")


@router.get("/api/authors", response_model=list[AuthorOut])
def list_authors(db: Annotated[Session, Depends(get_db)]):
    return db.query(Author).order_by(Author.name).all()


@router.get("/api/authors/{slug}", response_model=AuthorOut)
def get_author(slug: str, db: Annotated[Session, Depends(get_db)]):
    author = db.query(Author).filter(Author.slug == slug).first()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")
    return author


@router.get("/api/categories", response_model=list[CategoryOut])
def list_categories(db: Annotated[Session, Depends(get_db)]):
    return db.query(Category).order_by(Category.name).all()


def _admin_post_out(post: Post) -> PostAdminOut:
    return PostAdminOut(
        id=post.id,
        slug=post.slug,
        title=post.title,
        excerpt=post.excerpt,
        content_html=post.content_html,
        content_json=post.content_json,
        featured_image_key=post.featured_image_key,
        featured_image_url=resolve_image_url(post.featured_image_key),
        status=post.status,
        author_id=post.author_id,
        category_ids=[c.id for c in post.categories],
        published_at=post.published_at,
        has_visibility_password=bool(post.visibility_password_hash),
        meta_title=post.meta_title,
        meta_description=post.meta_description,
        focus_keyword=post.focus_keyword,
        seo_noindex=post.seo_noindex,
        deleted_at=post.deleted_at,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


def _apply_publish_fields(post: Post, status: PostStatus, published_at: datetime | None, visibility_password: str | None):
    post.status = status
    if published_at is not None:
        post.published_at = published_at
    elif status in (PostStatus.published, PostStatus.private) and not post.published_at:
        post.published_at = datetime.now(timezone.utc)

    if status == PostStatus.private:
        if visibility_password:
            post.visibility_password_hash = hash_password(visibility_password)
        elif not post.visibility_password_hash:
            raise HTTPException(status_code=400, detail="Private posts require a password")
    else:
        post.visibility_password_hash = None


def _editor_scope(q, user: CurrentUser, db: Session):
    if user.role == UserRole.editor:
        author = db.query(Author).filter(Author.user_id == user.id).first()
        if author:
            return q.filter(Post.author_id == author.id)
        return q.filter(Post.id == -1)
    return q


def _can_edit_post(post: Post, user: CurrentUser, db: Session) -> bool:
    if user.role == UserRole.admin:
        return True
    if user.role != UserRole.editor:
        return False
    author = db.query(Author).filter(Author.user_id == user.id).first()
    return bool(author and post.author_id == author.id)


@router.get("/api/editor/posts", response_model=list[PostAdminOut])
def editor_list_posts(
    user: EditorUser,
    db: Annotated[Session, Depends(get_db)],
    trash: bool = Query(False),
):
    purge_expired_trash(db)
    q = _trash_posts_query(db) if trash else _active_posts_query(db)
    q = _editor_scope(q, user, db)
    return [_admin_post_out(p) for p in q.order_by(Post.updated_at.desc()).all()]


@router.get("/api/editor/posts/{post_id}", response_model=PostAdminOut)
def editor_get_post(post_id: int, user: EditorUser, db: Annotated[Session, Depends(get_db)]):
    post = db.query(Post).options(joinedload(Post.categories)).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not _can_edit_post(post, user, db):
        raise HTTPException(status_code=403, detail="Cannot view this post")
    return _admin_post_out(post)


@router.post("/api/editor/posts", response_model=PostAdminOut, status_code=201)
def create_post(body: PostCreate, user: EditorUser, db: Annotated[Session, Depends(get_db)]):
    if db.query(Post).filter(Post.slug == body.slug).first():
        raise HTTPException(status_code=400, detail="Slug exists")
    post = Post(
        slug=body.slug,
        title=body.title,
        excerpt=body.excerpt,
        content_html=sanitize_html(body.content_html),
        content_json=body.content_json,
        featured_image_key=body.featured_image_key,
        author_id=body.author_id,
        meta_title=body.meta_title or None,
        meta_description=body.meta_description or None,
        focus_keyword=body.focus_keyword or None,
        seo_noindex=body.seo_noindex,
    )
    _apply_publish_fields(post, body.status, body.published_at, body.visibility_password)
    if user.role == UserRole.editor and not body.author_id:
        author = db.query(Author).filter(Author.user_id == user.id).first()
        if author:
            post.author_id = author.id
    if body.category_ids:
        post.categories = db.query(Category).filter(Category.id.in_(body.category_ids)).all()
    db.add(post)
    db.commit()
    db.refresh(post)
    return _admin_post_out(post)


@router.patch("/api/editor/posts/{post_id}", response_model=PostAdminOut)
def update_post(post_id: int, body: PostUpdate, user: EditorUser, db: Annotated[Session, Depends(get_db)]):
    post = db.query(Post).options(joinedload(Post.categories)).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not _can_edit_post(post, user, db):
        raise HTTPException(status_code=403, detail="Cannot edit this post")
    data = body.model_dump(exclude_unset=True)
    if "content_html" in data:
        data["content_html"] = sanitize_html(data["content_html"])
    visibility_password = data.pop("visibility_password", None)
    published_at = data.pop("published_at", None)
    status = data.pop("status", None)
    cat_ids = data.pop("category_ids", None)
    for k, v in data.items():
        setattr(post, k, v)
    if status is not None or published_at is not None or visibility_password is not None:
        _apply_publish_fields(
            post,
            status if status is not None else post.status,
            published_at,
            visibility_password,
        )
    if cat_ids is not None:
        post.categories = db.query(Category).filter(Category.id.in_(cat_ids)).all()
    db.commit()
    db.refresh(post)
    return _admin_post_out(post)


@router.delete("/api/editor/posts/{post_id}", status_code=204)
def trash_post(post_id: int, user: EditorUser, db: Annotated[Session, Depends(get_db)]):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not _can_edit_post(post, user, db):
        raise HTTPException(status_code=403, detail="Cannot delete this post")
    if post.deleted_at:
        raise HTTPException(status_code=400, detail="Already in trash")
    post.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/api/editor/posts/{post_id}/restore", response_model=PostAdminOut)
def restore_post(post_id: int, user: EditorUser, db: Annotated[Session, Depends(get_db)]):
    post = db.query(Post).options(joinedload(Post.categories)).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not _can_edit_post(post, user, db):
        raise HTTPException(status_code=403, detail="Cannot restore this post")
    if not post.deleted_at:
        raise HTTPException(status_code=400, detail="Not in trash")
    post.deleted_at = None
    db.commit()
    db.refresh(post)
    return _admin_post_out(post)


@router.delete("/api/editor/posts/{post_id}/permanent", status_code=204)
def permanent_delete_post(post_id: int, user: EditorUser, db: Annotated[Session, Depends(get_db)]):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not _can_edit_post(post, user, db):
        raise HTTPException(status_code=403, detail="Cannot delete this post")
    if not post.deleted_at:
        raise HTTPException(status_code=400, detail="Move to trash before permanent delete")
    db.delete(post)
    db.commit()


@router.post("/api/editor/uploads")
async def editor_upload(user: EditorUser, file: UploadFile = File(...)):
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Max 8MB")
    key = upload_file(content, file.filename or "image.jpg", file.content_type or "image/jpeg")
    url = get_public_url(key)
    return {"success": 1, "file": {"url": url, "key": key}}


@router.get("/api/admin/posts", response_model=list[PostAdminOut])
def admin_list_posts(
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
    trash: bool = Query(False),
):
    purge_expired_trash(db)
    q = _trash_posts_query(db) if trash else _active_posts_query(db)
    posts = q.order_by(Post.updated_at.desc()).all()
    return [_admin_post_out(p) for p in posts]


@router.get("/api/admin/blog-settings", response_model=BlogSettingsOut)
def get_settings(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    s = get_blog_settings(db)
    return BlogSettingsOut(trash_retention_months=s.trash_retention_months)


@router.patch("/api/admin/blog-settings", response_model=BlogSettingsOut)
def update_settings(body: BlogSettingsUpdate, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    if body.trash_retention_months not in (1, 6, 12):
        raise HTTPException(status_code=400, detail="Retention must be 1, 6, or 12 months")
    s = get_blog_settings(db)
    s.trash_retention_months = body.trash_retention_months
    db.commit()
    db.refresh(s)
    return BlogSettingsOut(trash_retention_months=s.trash_retention_months)
