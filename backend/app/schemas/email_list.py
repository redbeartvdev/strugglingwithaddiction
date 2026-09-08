from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class MailingListOut(BaseModel):
    id: int
    name: str
    slug: str
    description: str = ""
    auto_sources: list[str] = Field(default_factory=list)
    is_system: bool = False
    mailchimp_enabled: bool = False
    mailchimp_audience_id: str = ""
    mailchimp_tag: str = ""
    member_count: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None


class MailingListCreate(BaseModel):
    name: str
    description: str = ""
    auto_sources: list[str] = Field(default_factory=list)
    mailchimp_enabled: bool = False
    mailchimp_audience_id: str | None = None
    mailchimp_tag: str | None = None


class MailingListUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    auto_sources: list[str] | None = None
    mailchimp_enabled: bool | None = None
    mailchimp_audience_id: str | None = None
    mailchimp_tag: str | None = None


class MailingListSyncOut(BaseModel):
    synced: int
    failed: int
    skipped: int
    total: int


class ContactListRef(BaseModel):
    id: int
    name: str
    slug: str
    mailchimp_enabled: bool = False
    synced_at: datetime | None = None


class EmailListContactOut(BaseModel):
    id: int
    email: str
    name: str
    phone: str | None = None
    center_name: str | None = None
    continue_url: str | None = None
    source: str
    tags: list[str] = Field(default_factory=list)
    status: str
    notes: str | None = None
    mailchimp_synced_at: datetime | None = None
    last_event_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    lists: list[ContactListRef] = Field(default_factory=list)
    list_ids: list[int] = Field(default_factory=list)


class EmailListContactCreate(BaseModel):
    email: EmailStr
    name: str = ""
    phone: str | None = None
    center_name: str | None = None
    source: str = "manual"
    notes: str | None = None
    list_ids: list[int] = Field(default_factory=list)


class EmailListContactUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    center_name: str | None = None
    status: str | None = None
    notes: str | None = None
    list_ids: list[int] | None = None


class EmailListPage(BaseModel):
    total: int
    counts: dict[str, int]
    items: list[EmailListContactOut]
    lists: list[MailingListOut] = Field(default_factory=list)


class EmailListRebuildOut(BaseModel):
    upserted: int
    total: int


class MailingListMembersIn(BaseModel):
    contact_ids: list[int] = Field(default_factory=list)
    emails: list[EmailStr] = Field(default_factory=list)
