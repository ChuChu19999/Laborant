from typing import Callable, Optional
from sqlalchemy import Column


def build_order_by(
    sort_by: Optional[str],
    sort_order: Optional[str],
    sort_mapping: dict[str, Column],
    default_sort: Column,
) -> Column:
    """
    Построение order_by для SQLAlchemy запроса.
    """
    if not sort_by:
        return default_sort.desc()

    sort_order_func: Callable[[Column], Column] = lambda col: (
        col.desc() if sort_order == "desc" else col.asc()
    )

    column = sort_mapping.get(sort_by)
    if column is None:
        return default_sort.desc()

    return sort_order_func(column)


def validate_sort_order(sort_order: Optional[str]) -> bool:
    """
    Валидация направления сортировки.
    """
    return sort_order is None or sort_order in ("asc", "desc")
