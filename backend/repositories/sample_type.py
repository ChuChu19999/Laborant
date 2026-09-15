from __future__ import annotations
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.sample_type import SampleType
from repositories.base import (
    add_and_flush,
    execute_exists,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
    filter_not_deleted_unless,
)
from utils.filters import add_text_search_filter
from utils.sorting import build_order_by, natural_name_reverse, sort_by_natural_name


def _sample_type_load_options():
    return (
        selectinload(SampleType.laboratory),
        selectinload(SampleType.department),
    )


async def get_sample_type_by_id(
    db: AsyncSession, sample_type_id: int, include_deleted: bool = False
) -> SampleType | None:
    """Получить тип пробы по ID."""
    query = select(SampleType).options(*_sample_type_load_options()).where(SampleType.id == sample_type_id)
    query = filter_not_deleted_unless(query, SampleType.deleted_at, include_deleted)
    return await execute_scalar_one_or_none(db, query)


async def get_sample_types(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> list[SampleType]:
    """Получить список типов проб."""
    query = filter_not_deleted(select(SampleType).options(*_sample_type_load_options()), SampleType.deleted_at)

    conditions = []
    if laboratory_id:
        conditions.append(SampleType.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(SampleType.department_id == department_id)
    if search:
        add_text_search_filter(conditions, search, SampleType.name)
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "name": SampleType.name,
        "created_at": SampleType.created_at,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, SampleType.name)
    query = query.order_by(order_by)

    items = await execute_scalars_all(db, query)
    natural_reverse = natural_name_reverse(sort_by, sort_order, default_order="asc")
    if natural_reverse is not None:
        items = sort_by_natural_name(items, name_getter=lambda item: item.name, reverse=natural_reverse)
    return items


async def exists_sample_type_by_name(
    db: AsyncSession,
    name: str,
    laboratory_id: int,
    department_id: int | None,
    exclude_id: int | None = None,
) -> bool:
    """Проверить существование типа пробы с таким названием в scope."""
    query = filter_not_deleted(
        select(SampleType.id).where(
            SampleType.name == name.strip(),
            SampleType.laboratory_id == laboratory_id,
        ),
        SampleType.deleted_at,
    )
    if department_id is not None:
        query = query.where(SampleType.department_id == department_id)
    else:
        query = query.where(SampleType.department_id.is_(None))
    if exclude_id is not None:
        query = query.where(SampleType.id != exclude_id)
    return await execute_exists(db, query)


async def add_sample_type(db: AsyncSession, sample_type: SampleType) -> SampleType:
    """Добавить тип пробы."""
    await add_and_flush(db, sample_type)
    return sample_type
