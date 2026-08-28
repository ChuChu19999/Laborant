from __future__ import annotations
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.laboratory import Laboratory
from repositories.base import (
    add_and_flush,
    execute_exists,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
    filter_not_deleted_unless,
)
from utils.pagination import apply_pagination, get_total_count
from utils.sorting import build_order_by


def _build_laboratory_conditions(
    *,
    search: str | None = None,
) -> list[ColumnElement[bool]]:
    """Собрать условия фильтрации лабораторий."""
    conditions: list[ColumnElement[bool]] = []
    if search:
        conditions.append(
            or_(
                Laboratory.name.ilike(f"%{search}%"),
                Laboratory.full_name.ilike(f"%{search}%"),
            )
        )
    return conditions


async def get_laboratory_by_id(
    db: AsyncSession, laboratory_id: int, include_deleted: bool = False
) -> Laboratory | None:
    """Получить лабораторию по ID."""
    query = select(Laboratory).where(Laboratory.id == laboratory_id).options(selectinload(Laboratory.departments))
    query = filter_not_deleted_unless(query, Laboratory.deleted_at, include_deleted)
    return await execute_scalar_one_or_none(db, query)


async def get_laboratories(
    db: AsyncSession,
    page: int | None = None,
    page_size: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[Laboratory], int]:
    """Получить список лабораторий."""
    query = filter_not_deleted(select(Laboratory), Laboratory.deleted_at).options(selectinload(Laboratory.departments))

    conditions = _build_laboratory_conditions(search=search)
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "name": Laboratory.name,
        "full_name": Laboratory.full_name,
        "created_at": Laboratory.created_at,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, Laboratory.name, default_order="asc")
    query = query.order_by(order_by)

    count_query = filter_not_deleted(
        select(func.count()).select_from(Laboratory),
        Laboratory.deleted_at,
    )
    if conditions:
        count_query = count_query.where(*conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    laboratories = await execute_scalars_all(db, query)
    return laboratories, total


async def exists_laboratory_by_name(
    db: AsyncSession,
    name: str,
    exclude_id: int | None = None,
) -> bool:
    """Проверить существование лаборатории с таким названием."""
    query = filter_not_deleted(
        select(Laboratory.id).where(Laboratory.name == name.strip()),
        Laboratory.deleted_at,
    )
    if exclude_id is not None:
        query = query.where(Laboratory.id != exclude_id)
    return await execute_exists(db, query)


async def add_laboratory(db: AsyncSession, laboratory: Laboratory) -> Laboratory:
    """Добавить лабораторию."""
    await add_and_flush(db, laboratory)
    return laboratory


async def get_laboratory_id_by_name(db: AsyncSession, name: str) -> int | None:
    """Получить ID лаборатории по точному наименованию."""
    query = filter_not_deleted(
        select(Laboratory.id).where(Laboratory.name == name),
        Laboratory.deleted_at,
    )
    return await execute_scalar_one_or_none(db, query)


async def get_laboratories_for_visibility_scope(
    db: AsyncSession,
    laboratory_ids: list[int],
) -> list[tuple[int, str]]:
    """Получить id и названия лабораторий для области видимости."""
    if not laboratory_ids:
        return []

    query = filter_not_deleted(
        select(Laboratory.id, Laboratory.name).where(
            Laboratory.id.in_(laboratory_ids),
        ),
        Laboratory.deleted_at,
    )
    lab_result = await db.execute(query)
    return [(row[0], row[1]) for row in lab_result.all()]


async def get_existing_laboratory_ids(
    db: AsyncSession,
    laboratory_ids: list[int],
    *,
    include_deleted: bool = False,
) -> set[int]:
    """Вернуть множество id лабораторий, которые есть в БД."""
    if not laboratory_ids:
        return set()

    unique_ids = list(dict.fromkeys(laboratory_ids))
    query = select(Laboratory.id).where(Laboratory.id.in_(unique_ids))
    query = filter_not_deleted_unless(query, Laboratory.deleted_at, include_deleted)
    return set(await execute_scalars_all(db, query))
