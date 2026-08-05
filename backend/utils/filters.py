import pendulum
from sqlalchemy import Column


def add_date_range_filter(
    conditions: list,
    date_from: pendulum.DateTime | None,
    date_to: pendulum.DateTime | None,
    date_column: Column,
) -> None:
    """Добавление фильтра по диапазону дат."""
    if date_from:
        conditions.append(date_column >= date_from)

    if date_to:
        # Если время 00:00, расширяем до конца дня
        if date_to.hour == 0 and date_to.minute == 0:
            date_to = pendulum.instance(date_to).end_of("day").naive()
        conditions.append(date_column <= date_to)


def add_text_search_filter(
    conditions: list, search_text: str | None, column: Column
) -> None:
    """Добавление фильтра по текстовому поиску (ILIKE с %)."""
    if search_text:
        conditions.append(column.ilike(f"%{search_text}%"))
