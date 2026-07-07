from __future__ import annotations
from typing import Any, Optional, TypeVar
from sqlalchemy import Select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from models.base import BaseModel

T = TypeVar("T", bound=BaseModel)


def filter_not_deleted(
    query: Select[tuple[T]],
    deleted_at_column: InstrumentedAttribute[Any],
) -> Select[tuple[T]]:
    """Добавить фильтр по неудалённым записям."""
    return query.where(deleted_at_column.is_(None))


async def add_and_flush(db: AsyncSession, entity: BaseModel) -> None:
    """Добавить сущность в сессию и выполнить flush."""
    db.add(entity)
    await db.flush()


async def flush_entity(db: AsyncSession) -> None:
    """Выполнить flush сессии."""
    await db.flush()


async def refresh_entity(db: AsyncSession, entity: BaseModel) -> None:
    """Перечитать сущность из БД после flush.

    Используется только там, где после INSERT нужны server default или триггеры.
    При expire_on_commit=False и записи полей через ORM refresh обычно не нужен.
    """
    await db.refresh(entity)


async def execute_scalar_one_or_none(
    db: AsyncSession,
    query: Select[tuple[T]],
) -> Optional[T]:
    """Выполнить запрос и вернуть одну сущность или None."""
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def execute_scalars_all(
    db: AsyncSession,
    query: Select[tuple[T]],
) -> list[T]:
    """Выполнить запрос и вернуть список сущностей."""
    result = await db.execute(query)
    return list(result.scalars().all())
