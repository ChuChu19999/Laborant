from __future__ import annotations
from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from models.role import Role
from repositories.base import (
    add_and_flush,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
    refresh_entity,
)
from utils.pagination import apply_pagination, get_total_count
from utils.sorting import build_order_by


async def get_role_by_id(
    db: AsyncSession,
    role_id: int,
    include_deleted: bool = False,
) -> Optional[Role]:
    """Получить роль по ID."""
    query = select(Role).where(Role.id == role_id)
    if not include_deleted:
        query = filter_not_deleted(query, Role.deleted_at)
    return await execute_scalar_one_or_none(db, query)


async def get_roles(
    db: AsyncSession,
    search: Optional[str] = None,
    role_type: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
) -> tuple[list[Role], int]:
    """Получить список ролей из справочника."""
    query = filter_not_deleted(select(Role), Role.deleted_at)

    if search:
        query = query.where(Role.name.ilike(f"%{search}%"))

    if role_type:
        query = query.where(Role.role_type == role_type)

    sort_mapping = {
        "name": Role.name,
        "role_type": Role.role_type,
        "created_at": Role.created_at,
        "updated_at": Role.updated_at,
    }
    order_by = build_order_by(
        sort_by,
        sort_order,
        sort_mapping,
        Role.id,
        default_order="asc",
    )
    query = query.order_by(order_by)

    count_query = (
        select(func.count()).select_from(Role).where(Role.deleted_at.is_(None))
    )
    if search:
        count_query = count_query.where(Role.name.ilike(f"%{search}%"))
    if role_type:
        count_query = count_query.where(Role.role_type == role_type)
    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    items = await execute_scalars_all(db, query)
    return items, total


async def exists_role_by_name_and_type(
    db: AsyncSession,
    name: str,
    role_type: str,
    exclude_id: Optional[int] = None,
) -> bool:
    """Проверить существование роли с таким наименованием и типом."""
    conditions = [
        func.lower(Role.name) == name.lower(),
        Role.role_type == role_type,
        Role.deleted_at.is_(None),
    ]
    if exclude_id is not None:
        conditions.append(Role.id != exclude_id)

    query = select(Role).where(*conditions)
    existing = await execute_scalar_one_or_none(db, query)
    return existing is not None


async def add_role(db: AsyncSession, role: Role) -> Role:
    """Добавить роль в сессию и выполнить flush."""
    await add_and_flush(db, role)
    await refresh_entity(db, role)
    return role
