from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Универсальная схема для пагинированных ответов."""

    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    class Config:
        from_attributes = True
