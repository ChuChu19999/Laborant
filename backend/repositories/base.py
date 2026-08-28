from __future__ import annotations
from typing import Any, TypeVar, cast
from sqlalchemy import Select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from models.base import BaseModel

T = TypeVar("T")
_SelectRow = TypeVar("_SelectRow", bound=tuple[Any, ...])


def filter_not_deleted(
    query: Select[_SelectRow],
    deleted_at_column: InstrumentedAttribute[Any],
) -> Select[_SelectRow]:
    """Добавить фильтр по неудалённым записям."""
    return query.where(deleted_at_column.is_(None))


def filter_not_deleted_unless(
    query: Select[_SelectRow],
    deleted_at_column: InstrumentedAttribute[Any],
    include_deleted: bool,
) -> Select[_SelectRow]:
    """Фильтр soft-delete, если include_deleted=False."""
    if include_deleted:
        return query
    return filter_not_deleted(query, deleted_at_column)


async def add_and_flush(db: AsyncSession, entity: BaseModel) -> None:
    """Добавить сущность и выполнить flush."""
    db.add(entity)
    await db.flush()


async def flush_entity(db: AsyncSession) -> None:
    """Выполнить flush сессии."""
    await db.flush()


async def refresh_entity(db: AsyncSession, entity: BaseModel) -> None:
    """Перечитать сущность из БД после flush."""
    await db.refresh(entity)


async def execute_scalar_one_or_none(
    db: AsyncSession,
    query: Select[tuple[T]],
) -> T | None:
    """Выполнить запрос и вернуть один скаляр/сущность или None."""
    result = await db.execute(query)
    return cast(T | None, result.scalar_one_or_none())


async def execute_scalars_all(
    db: AsyncSession,
    query: Select[tuple[T]],
) -> list[T]:
    """Выполнить запрос и вернуть список скаляров/сущностей."""
    result = await db.execute(query)
    return list(result.scalars().all())


async def execute_exists(
    db: AsyncSession,
    query: Select[Any],
) -> bool:
    """Выполнить запрос и вернуть True, если есть хотя бы одна строка."""
    return await execute_scalar_one_or_none(db, query) is not None
