from __future__ import annotations
from typing import Any
import pendulum
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement

SqlColumn = ColumnElement[Any] | InstrumentedAttribute[Any]


def add_date_range_filter(
    conditions: list[Any],
    date_from: pendulum.DateTime | None,
    date_to: pendulum.DateTime | None,
    date_column: SqlColumn,
) -> None:
    """Добавить фильтр по диапазону дат."""
    if date_from:
        conditions.append(date_column >= date_from)

    if date_to:
        # Если время 00:00, расширяем до конца дня (naive — контракт query-парсера).
        if date_to.hour == 0 and date_to.minute == 0:
            date_to = pendulum.instance(date_to).end_of("day").naive()
        conditions.append(date_column <= date_to)


def add_text_search_filter(
    conditions: list[Any],
    search_text: str | None,
    column: SqlColumn,
) -> None:
    """Добавить текстовый фильтр (ILIKE с %)."""
    if search_text:
        conditions.append(column.ilike(f"%{search_text}%"))
