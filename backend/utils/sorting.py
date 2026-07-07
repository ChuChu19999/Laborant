from collections.abc import Callable
from sqlalchemy import Column


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

    sort_order_func: Callable[[Column], Column] = lambda col: (
        col.desc() if sort_order == "desc" else col.asc()
    )

    column = sort_mapping.get(sort_by)
    if column is None:
        return default_sort.desc() if default_order == "desc" else default_sort.asc()

    return sort_order_func(column)
