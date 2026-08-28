from __future__ import annotations
import math
from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Обёртка пагинированного списка."""

    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


def resolve_total_pages(total: int, page: int | None, page_size: int | None) -> int:
    """Вычислить число страниц для PaginatedResponse: при page/page_size — ceil, иначе 0 или 1."""
    if page is not None and page_size is not None:
        return math.ceil(total / page_size) if total > 0 else 0
    return 1 if total > 0 else 0


def build_paginated_response(
    items: list[T],
    total: int,
    page: int | None,
    page_size: int | None,
) -> PaginatedResponse[T]:
    """Собрать PaginatedResponse из списка элементов и параметров пагинации."""
    return PaginatedResponse(
        items=items,
        total=total,
        page=page if page is not None else 1,
        page_size=page_size if page_size is not None else total,
        total_pages=resolve_total_pages(total, page, page_size),
    )
