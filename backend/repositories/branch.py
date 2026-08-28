from __future__ import annotations
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.branch import Branch
from repositories.base import (
    add_and_flush,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
    filter_not_deleted_unless,
)
from utils.filters import add_text_search_filter
from utils.sorting import build_order_by, natural_name_reverse, sort_by_natural_name


async def get_branch_by_id(
    db: AsyncSession,
    branch_id: int,
    include_deleted: bool = False,
    *,
    load_sampling_locations: bool = False,
) -> Branch | None:
    """Получить филиал по ID."""
    options = [selectinload(Branch.laboratory), selectinload(Branch.department)]
    if load_sampling_locations:
        options.append(selectinload(Branch.sampling_locations))
    query = select(Branch).where(Branch.id == branch_id).options(*options)
    query = filter_not_deleted_unless(query, Branch.deleted_at, include_deleted)
    return await execute_scalar_one_or_none(db, query)


async def get_branches(
    db: AsyncSession,
    laboratory_id: int | None = None,
    department_id: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> list[Branch]:
    """Получить список филиалов."""
    query = filter_not_deleted(select(Branch), Branch.deleted_at).options(
        selectinload(Branch.laboratory), selectinload(Branch.department)
    )

    if laboratory_id:
        query = query.where(Branch.laboratory_id == laboratory_id)
    if department_id:
        query = query.where(Branch.department_id == department_id)

    conditions = []
    if search:
        add_text_search_filter(conditions, search, Branch.name)
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "name": Branch.name,
        "created_at": Branch.created_at,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, Branch.created_at)
    query = query.order_by(order_by)

    branches = await execute_scalars_all(db, query)
    natural_reverse = natural_name_reverse(sort_by, sort_order, default_order="desc")
    if natural_reverse is not None:
        branches = sort_by_natural_name(
            branches,
            name_getter=lambda item: item.name,
            reverse=natural_reverse,
        )
    return branches


async def add_branch(db: AsyncSession, branch: Branch) -> Branch:
    """Добавить филиал."""
    await add_and_flush(db, branch)
    return branch
