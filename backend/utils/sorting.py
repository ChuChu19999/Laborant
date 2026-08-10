from __future__ import annotations
from collections.abc import Callable
import re
from typing import TypeVar
from sqlalchemy import Column

T = TypeVar("T")


def build_order_by(
    sort_by: str | None,
    sort_order: str | None,
    sort_mapping: dict[str, Column],
    default_sort: Column,
    default_order: str = "desc",
) -> Column:
    """Построение order_by для SQLAlchemy запроса."""
    if not sort_by:
        return default_sort.desc() if default_order == "desc" else default_sort.asc()

    sort_order_func: Callable[[Column], Column] = lambda col: col.desc() if sort_order == "desc" else col.asc()

    column = sort_mapping.get(sort_by)
    if column is None:
        return default_sort.desc() if default_order == "desc" else default_sort.asc()

    return sort_order_func(column)


def natural_sort_key(value: str | None) -> list:
    """Ключ натуральной сортировки: буквы и числа учитываются по отдельности."""
    text = (value or "").casefold()
    parts: list = []
    for chunk in re.split(r"(\d+)", text):
        if not chunk:
            continue
        if chunk.isdigit():
            parts.append((0, int(chunk)))
        else:
            parts.append((1, chunk))
    return parts


def sort_by_natural_name(
    items: list[T],
    *,
    name_getter: Callable[[T], str | None],
    reverse: bool = False,
) -> list[T]:
    """Отсортировать список по имени с учётом чисел (ГПА-1, ГПА-2, ГПА-10)."""
    return sorted(
        items,
        key=lambda item: natural_sort_key(name_getter(item)),
        reverse=reverse,
    )
