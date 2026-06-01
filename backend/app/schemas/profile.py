from pydantic import BaseModel, Field


class SocialLinks(BaseModel):
    twitter: str | None = None
    linkedin: str | None = None
    facebook: str | None = None
    instagram: str | None = None
    website: str | None = None


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    slug: str | None = None
    title: str | None = None
    bio: str | None = None
    phone: str | None = None
    address_line: str | None = None
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    country: str | None = None
    social_links: SocialLinks | None = None


class ProfileOut(BaseModel):
    display_name: str
    slug: str | None
    title: str | None
    bio: str | None
    phone: str | None
    address_line: str | None
    city: str | None
    state: str | None
    zip: str | None
    country: str | None
    profile_photo_url: str | None = None
    social_links: dict | None = None
    email: str | None = None
    role: str | None = None

    model_config = {"from_attributes": True}
