from pydantic import BaseModel, Field


class ServiceCodeOut(BaseModel):
    id: int
    category_code: str
    category_name: str
    service_code: str
    service_name: str
    service_description: str = ""
    enabled: bool = True
    sort_order: int = 0

    model_config = {"from_attributes": True}


class ServiceCodePublic(BaseModel):
    category_code: str
    category_name: str
    service_code: str
    service_name: str
    service_description: str = ""


class ServiceCodeCategory(BaseModel):
    category_code: str
    category_name: str
    codes: list[ServiceCodeOut] = Field(default_factory=list)


class ServiceCodeCreate(BaseModel):
    category_code: str = Field(..., min_length=1, max_length=16)
    category_name: str = Field(..., min_length=1, max_length=120)
    service_code: str = Field(..., min_length=1, max_length=40)
    service_name: str = Field(..., min_length=1, max_length=255)
    service_description: str = ""
    enabled: bool = True
    sort_order: int | None = None


class ServiceCodeUpdate(BaseModel):
    category_code: str | None = Field(default=None, max_length=16)
    category_name: str | None = Field(default=None, max_length=120)
    service_code: str | None = Field(default=None, max_length=40)
    service_name: str | None = Field(default=None, max_length=255)
    service_description: str | None = None
    enabled: bool | None = None
    sort_order: int | None = None


class ServiceCodeSeedResult(BaseModel):
    created: int
    updated: int
    total: int
