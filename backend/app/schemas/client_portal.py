from datetime import datetime

from pydantic import BaseModel

from app.models.client_portal import ClientPostStatus


class LandingPageOut(BaseModel):
    headline: str
    about_html: str
    hero_image_url: str | None = None
    is_published: bool
    meta_title: str | None
    meta_description: str | None
    slug: str | None
    display_name: str | None


class LandingPageUpdate(BaseModel):
    headline: str | None = None
    about_html: str | None = None
    is_published: bool | None = None
    meta_title: str | None = None
    meta_description: str | None = None


class ClientPostOut(BaseModel):
    id: int
    slug: str
    title: str
    excerpt: str
    content_html: str
    status: ClientPostStatus
    published_at: datetime | None

    model_config = {"from_attributes": True}


class ClientPostCreate(BaseModel):
    slug: str
    title: str
    excerpt: str = ""
    content_html: str = ""
    status: ClientPostStatus = ClientPostStatus.draft


class ClientPostUpdate(BaseModel):
    slug: str | None = None
    title: str | None = None
    excerpt: str | None = None
    content_html: str | None = None
    status: ClientPostStatus | None = None


class ClientPostPublic(BaseModel):
    slug: str
    title: str
    excerpt: str
    content: str
    published_at: str | None
