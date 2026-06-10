from datetime import datetime

from pydantic import BaseModel, Field

from app.models.directory_page import DirectoryPageStatus, DirectoryPageType


class FaqItem(BaseModel):
    question: str
    answer: str


class DirectoryPagePublic(BaseModel):
    page_type: DirectoryPageType
    state_slug: str
    city_slug: str | None = None
    title: str
    body_html: str
    faq: list[FaqItem] = Field(default_factory=list)
    meta_title: str | None = None
    meta_description: str | None = None
    filter_state: str | None = None
    filter_city: str | None = None
    filter_insurance: str | None = None


class DirectoryPageAdmin(BaseModel):
    id: int
    page_type: DirectoryPageType
    status: DirectoryPageStatus
    state_slug: str
    city_slug: str | None
    title: str
    body_html: str
    faq_json: list[dict] = Field(default_factory=list)
    meta_title: str | None
    meta_description: str | None
    filter_state: str | None
    filter_city: str | None
    filter_insurance: str | None
    published_at: datetime | None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class DirectoryPageCreate(BaseModel):
    page_type: DirectoryPageType
    state_slug: str
    city_slug: str | None = None
    title: str
    body_html: str = ""
    faq_json: list[dict] = Field(default_factory=list)
    meta_title: str | None = None
    meta_description: str | None = None
    filter_state: str | None = None
    filter_city: str | None = None
    filter_insurance: str | None = None
    status: DirectoryPageStatus = DirectoryPageStatus.draft
    published_at: datetime | None = None


class DirectoryPageUpdate(BaseModel):
    page_type: DirectoryPageType | None = None
    state_slug: str | None = None
    city_slug: str | None = None
    title: str | None = None
    body_html: str | None = None
    faq_json: list[dict] | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    filter_state: str | None = None
    filter_city: str | None = None
    filter_insurance: str | None = None
    status: DirectoryPageStatus | None = None
    published_at: datetime | None = None
