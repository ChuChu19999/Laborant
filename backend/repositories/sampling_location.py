from __future__ import annotations
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.sampling_location import SamplingLocation
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


async def get_sampling_location_by_id(
    db: AsyncSession, sampling_location_id: int, include_deleted: bool = False
) -> SamplingLocation | None:
    """Получить место отбора пробы по ID."""
    query = (
        select(SamplingLocation)
        .where(SamplingLocation.id == sampling_location_id)
        .options(selectinload(SamplingLocation.branch))
    )
    query = filter_not_deleted_unless(query, SamplingLocation.deleted_at, include_deleted)
    return await execute_scalar_one_or_none(db, query)


async def get_sampling_locations(
    db: AsyncSession,
    branch_id: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> list[SamplingLocation]:
    """Получить список мест отбора проб."""
    query = filter_not_deleted(select(SamplingLocation), SamplingLocation.deleted_at).options(
        selectinload(SamplingLocation.branch)
    )

    if branch_id:
        query = query.where(SamplingLocation.branch_id == branch_id)

    conditions = []
    if search:
        add_text_search_filter(conditions, search, SamplingLocation.name)
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "name": SamplingLocation.name,
        "created_at": SamplingLocation.created_at,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, SamplingLocation.created_at)
    query = query.order_by(order_by)

    locations = await execute_scalars_all(db, query)
    natural_reverse = natural_name_reverse(sort_by, sort_order, default_order="desc")
    if natural_reverse is not None:
        locations = sort_by_natural_name(
            locations,
            name_getter=lambda item: item.name,
            reverse=natural_reverse,
        )
    return locations


async def exists_sampling_location_by_name_and_branch(
    db: AsyncSession,
    branch_id: int,
    name: str,
    exclude_id: int | None = None,
) -> bool:
    """Проверить существование места отбора с таким названием в филиале."""
    query = filter_not_deleted(
        select(SamplingLocation.id).where(
            SamplingLocation.branch_id == branch_id,
            SamplingLocation.name == name.strip(),
        ),
        SamplingLocation.deleted_at,
    )
    if exclude_id is not None:
        query = query.where(SamplingLocation.id != exclude_id)
    return await execute_exists(db, query)


async def add_sampling_location(db: AsyncSession, sampling_location: SamplingLocation) -> SamplingLocation:
    """Добавить место отбора пробы."""
    await add_and_flush(db, sampling_location)
    return sampling_location
