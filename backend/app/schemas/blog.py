from datetime import datetime

from pydantic import BaseModel, Field

from app.models.blog import PostStatus


class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str

    model_config = {"from_attributes": True}


class AuthorOut(BaseModel):
    id: int
    slug: str
    name: str
    title: str | None
    bio: str | None

    model_config = {"from_attributes": True}


class PostListItem(BaseModel):
    id: int
    slug: str
    date: str
    title: str
    excerpt: str
    featuredImage: str | None
    categoryNames: list[CategoryOut]
    authorId: int | None

    model_config = {"from_attributes": True}


class PostDetail(BaseModel):
    id: int
    slug: str
    date: str
    title: str
    excerpt: str
    content: str
    featuredImage: str | None
    categoryNames: list[CategoryOut]
    authorId: int | None
    author: AuthorOut | None = None
    metaTitle: str | None = None
    metaDescription: str | None = None
    seoNoindex: bool = False


class PostCreate(BaseModel):
    slug: str
    title: str
    excerpt: str = ""
    content_html: str = ""
    content_json: str | None = None
    featured_image_key: str | None = None
    status: PostStatus = PostStatus.draft
    author_id: int | None = None
    category_ids: list[int] = Field(default_factory=list)
    published_at: datetime | None = None
    visibility_password: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    focus_keyword: str | None = None
    seo_noindex: bool = False


class PostUpdate(BaseModel):
    slug: str | None = None
    title: str | None = None
    excerpt: str | None = None
    content_html: str | None = None
    content_json: str | None = None
    featured_image_key: str | None = None
    status: PostStatus | None = None
    author_id: int | None = None
    category_ids: list[int] | None = None
    published_at: datetime | None = None
    visibility_password: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    focus_keyword: str | None = None
    seo_noindex: bool | None = None


class PostAdminOut(BaseModel):
    id: int
    slug: str
    title: str
    excerpt: str
    content_html: str
    content_json: str | None = None
    featured_image_key: str | None
    featured_image_url: str | None = None
    status: PostStatus
    author_id: int | None
    category_ids: list[int]
    published_at: datetime | None
    has_visibility_password: bool = False
    meta_title: str | None = None
    meta_description: str | None = None
    focus_keyword: str | None = None
    seo_noindex: bool = False
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BlogSettingsOut(BaseModel):
    trash_retention_months: int

    model_config = {"from_attributes": True}


class BlogSettingsUpdate(BaseModel):
    trash_retention_months: int
