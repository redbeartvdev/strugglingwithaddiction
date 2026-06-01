from typing import Literal

from pydantic import BaseModel


class SearchHit(BaseModel):
    type: Literal["post", "center", "user", "claim", "page"]
    id: int | str
    label: str
    meta: str | None = None


class SearchOut(BaseModel):
    q: str
    results: list[SearchHit]
