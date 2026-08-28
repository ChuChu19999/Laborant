from __future__ import annotations
import math
from sqlalchemy import Select
from sqlalchemy.ext.asyncio import AsyncSession


def calculate_pagination(page: int, page_size: int) -> tuple[int, int]:
    """Вычислить offset и limit для пагинации."""
    offset = (page - 1) * page_size
    return offset, page_size


def calculate_total_pages(total: int, page_size: int) -> int:
    """Вычислить общее количество страниц."""
    return math.ceil(total / page_size) if total > 0 else 0


async def get_total_count(db: AsyncSession, count_query: Select[tuple[int]]) -> int:
    """Получить общее количество записей из count-запроса."""
    result = await db.execute(count_query)
    return result.scalar() or 0


def apply_pagination(query: Select, page: int, page_size: int) -> Select:
    """Применить пагинацию к SQLAlchemy-запросу."""
    offset, limit = calculate_pagination(page, page_size)
    return query.offset(offset).limit(limit)
