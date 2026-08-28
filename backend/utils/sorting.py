from __future__ import annotations
from collections.abc import Callable, Mapping
import re
from typing import Any, TypeVar
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement

T = TypeVar("T")
SqlColumn = ColumnElement[Any] | InstrumentedAttribute[Any]


def build_order_by(
    sort_by: str | None,
    sort_order: str | None,
    sort_mapping: Mapping[str, SqlColumn],
    default_sort: SqlColumn,
    default_order: str = "desc",
) -> ColumnElement[Any]:
    """Построить order_by для SQLAlchemy-запроса."""
    if not sort_by:
        return default_sort.desc() if default_order == "desc" else default_sort.asc()

    column = sort_mapping.get(sort_by)
    if column is None:
        return default_sort.desc() if default_order == "desc" else default_sort.asc()

    return column.desc() if sort_order == "desc" else column.asc()


def natural_sort_key(value: str | None) -> list[Any]:
    """Ключ натуральной сортировки: буквы и числа учитываются по отдельности."""
    text = (value or "").casefold()
    parts: list[Any] = []
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


def natural_name_reverse(
    sort_by: str | None,
    sort_order: str | None,
    *,
    default_order: str,
) -> bool | None:
    """Нужна ли натуральная сортировка по name и в каком направлении.

    Возвращает None, если сортировка не по name.
    Иначе True — по убыванию, False — по возрастанию.
    """
    if sort_by is not None and sort_by != "name":
        return None
    order = sort_order if sort_order is not None else default_order
    return order == "desc"
