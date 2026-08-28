from __future__ import annotations
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.selection_conditions import SelectionConditions
from repositories.base import (
    add_and_flush,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
    filter_not_deleted_unless,
)
from utils.pagination import apply_pagination, get_total_count
from utils.sorting import build_order_by


def _build_selection_conditions_filters(
    *,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> list[ColumnElement[bool]]:
    """Собрать фильтрацию условий отбора."""
    conditions: list[ColumnElement[bool]] = []
    if laboratory_id:
        conditions.append(SelectionConditions.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(SelectionConditions.department_id == department_id)
    return conditions


async def get_selection_conditions_by_id(
    db: AsyncSession, conditions_id: int, include_deleted: bool = False
) -> SelectionConditions | None:
    """Получить условия отбора по ID."""
    query = (
        select(SelectionConditions)
        .where(SelectionConditions.id == conditions_id)
        .options(
            selectinload(SelectionConditions.laboratory),
            selectinload(SelectionConditions.department),
        )
    )
    query = filter_not_deleted_unless(query, SelectionConditions.deleted_at, include_deleted)
    return await execute_scalar_one_or_none(db, query)


async def get_selection_conditions(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    page: int | None = None,
    page_size: int | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[SelectionConditions], int]:
    """Получить список условий отбора."""
    query = filter_not_deleted(select(SelectionConditions), SelectionConditions.deleted_at).options(
        selectinload(SelectionConditions.laboratory),
        selectinload(SelectionConditions.department),
    )

    conditions = _build_selection_conditions_filters(
        laboratory_id=laboratory_id,
        department_id=department_id,
    )
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "created_at": SelectionConditions.created_at,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, SelectionConditions.created_at)
    query = query.order_by(order_by)

    count_query = filter_not_deleted(
        select(func.count()).select_from(SelectionConditions),
        SelectionConditions.deleted_at,
    )
    if conditions:
        count_query = count_query.where(*conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    selection_conditions = await execute_scalars_all(db, query)
    return selection_conditions, total


async def add_selection_conditions(db: AsyncSession, selection_conditions: SelectionConditions) -> SelectionConditions:
    """Добавить условия отбора."""
    await add_and_flush(db, selection_conditions)
    return selection_conditions
