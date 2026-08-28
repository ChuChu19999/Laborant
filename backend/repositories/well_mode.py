from __future__ import annotations
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.well_mode import WellMode
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


async def get_well_mode_by_id(db: AsyncSession, well_mode_id: int, include_deleted: bool = False) -> WellMode | None:
    """Получить режим скважины по ID."""
    query = select(WellMode).where(WellMode.id == well_mode_id).options(selectinload(WellMode.branch))
    query = filter_not_deleted_unless(query, WellMode.deleted_at, include_deleted)
    return await execute_scalar_one_or_none(db, query)


async def get_well_modes(
    db: AsyncSession,
    branch_id: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> list[WellMode]:
    """Получить список режимов скважин."""
    query = filter_not_deleted(select(WellMode), WellMode.deleted_at).options(selectinload(WellMode.branch))

    if branch_id:
        query = query.where(WellMode.branch_id == branch_id)

    conditions = []
    if search:
        add_text_search_filter(conditions, search, WellMode.name)
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "name": WellMode.name,
        "created_at": WellMode.created_at,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, WellMode.created_at)
    query = query.order_by(order_by)

    well_modes = await execute_scalars_all(db, query)
    natural_reverse = natural_name_reverse(sort_by, sort_order, default_order="desc")
    if natural_reverse is not None:
        well_modes = sort_by_natural_name(
            well_modes,
            name_getter=lambda item: item.name,
            reverse=natural_reverse,
        )
    return well_modes


async def exists_well_mode_by_name_and_branch(
    db: AsyncSession,
    branch_id: int,
    name: str,
    exclude_id: int | None = None,
) -> bool:
    """Проверить существование режима скважины с таким названием в филиале."""
    query = filter_not_deleted(
        select(WellMode.id).where(
            WellMode.branch_id == branch_id,
            WellMode.name == name.strip(),
        ),
        WellMode.deleted_at,
    )
    if exclude_id is not None:
        query = query.where(WellMode.id != exclude_id)
    return await execute_exists(db, query)


async def add_well_mode(db: AsyncSession, well_mode: WellMode) -> WellMode:
    """Добавить режим скважины."""
    await add_and_flush(db, well_mode)
    return well_mode
