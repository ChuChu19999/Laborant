from typing import Optional
import pendulum
from sqlalchemy import Column


def add_date_range_filter(
    conditions: list,
    date_from: Optional[pendulum.DateTime],
    date_to: Optional[pendulum.DateTime],
    date_column: Column,
) -> None:
    """
    Добавление фильтра по диапазону дат.
    """
    if date_from:
        conditions.append(date_column >= date_from)

    if date_to:
        # Если время 00:00, расширяем до конца дня
        if date_to.hour == 0 and date_to.minute == 0:
            date_to = pendulum.instance(date_to).end_of("day").naive()
        conditions.append(date_column <= date_to)


def add_text_search_filter(
    conditions: list, search_text: Optional[str], column: Column
) -> None:
    """
    Добавление фильтра по текстовому поиску (ILIKE с %).
    """
    if search_text:
        conditions.append(column.ilike(f"%{search_text}%"))


def add_list_filter(conditions: list, values: Optional[list], column: Column) -> None:
    """
    Добавление фильтра по списку значений (IN).
    """
    if values and len(values) > 0:
        conditions.append(column.in_(values))


def add_enum_list_filter(
    conditions: list,
    values: Optional[list[str]],
    column: Column,
    enum_class: type,
) -> None:
    """
    Добавление фильтра по списку enum значений.
    """
    if values and len(values) > 0:
        enum_values = [
            enum_class(v) for v in values if v in [e.value for e in enum_class]
        ]
        if enum_values:
            conditions.append(column.in_(enum_values))
