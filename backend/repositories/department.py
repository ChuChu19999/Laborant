from __future__ import annotations
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.department import Department
from models.laboratory import Laboratory
from repositories.base import (
    add_and_flush,
    execute_exists,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
    filter_not_deleted_unless,
)
from utils.filters import add_text_search_filter
from utils.pagination import apply_pagination, get_total_count
from utils.sorting import build_order_by


def _build_department_conditions(
    *,
    laboratory_id: int | None = None,
    search: str | None = None,
) -> list[ColumnElement[bool]]:
    """Собрать условия фильтрации подразделений."""
    conditions: list[ColumnElement[bool]] = []
    if laboratory_id:
        conditions.append(Department.laboratory_id == laboratory_id)
    if search:
        add_text_search_filter(conditions, search, Department.name)
    return conditions


async def get_department_by_id(
    db: AsyncSession, department_id: int, include_deleted: bool = False
) -> Department | None:
    """Получить подразделение по ID."""
    query = select(Department).where(Department.id == department_id).options(selectinload(Department.laboratory))
    query = filter_not_deleted_unless(query, Department.deleted_at, include_deleted)
    return await execute_scalar_one_or_none(db, query)


async def get_departments(
    db: AsyncSession,
    laboratory_id: int | None = None,
    page: int | None = None,
    page_size: int | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[Department], int]:
    """Получить список подразделений."""
    query = filter_not_deleted(select(Department), Department.deleted_at).options(selectinload(Department.laboratory))

    conditions = _build_department_conditions(laboratory_id=laboratory_id, search=search)
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "name": Department.name,
        "created_at": Department.created_at,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, Department.name, default_order="asc")
    query = query.order_by(order_by)

    count_query = filter_not_deleted(
        select(func.count()).select_from(Department),
        Department.deleted_at,
    )
    if conditions:
        count_query = count_query.where(*conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    departments = await execute_scalars_all(db, query)
    return departments, total


async def exists_department_by_name_and_laboratory(
    db: AsyncSession,
    laboratory_id: int,
    name: str,
    exclude_id: int | None = None,
) -> bool:
    """Проверить существование подразделения с таким названием в лаборатории."""
    query = filter_not_deleted(
        select(Department.id).where(
            Department.laboratory_id == laboratory_id,
            Department.name == name.strip(),
        ),
        Department.deleted_at,
    )
    if exclude_id is not None:
        query = query.where(Department.id != exclude_id)
    return await execute_exists(db, query)


async def add_department(db: AsyncSession, department: Department) -> Department:
    """Добавить подразделение."""
    await add_and_flush(db, department)
    return department


async def get_departments_for_visibility_scope(
    db: AsyncSession,
    department_ids: list[int],
) -> list[tuple[int, str, str, str | None]]:
    """Получить подразделения с названиями лабораторий для области видимости."""
    if not department_ids:
        return []

    query = filter_not_deleted(
        select(Department.id, Department.name, Laboratory.name, Laboratory.full_name)
        .join(Laboratory, Department.laboratory_id == Laboratory.id)
        .where(Department.id.in_(department_ids)),
        Department.deleted_at,
    )
    query = filter_not_deleted(query, Laboratory.deleted_at)
    dept_result = await db.execute(query)
    return [(row[0], row[1], row[2], row[3]) for row in dept_result.all()]


async def get_department_laboratory_id_map(
    db: AsyncSession,
    department_ids: list[int],
    *,
    include_deleted: bool = False,
) -> dict[int, int]:
    """Вернуть словарь id подразделения → laboratory_id для существующих записей."""
    if not department_ids:
        return {}

    unique_ids = list(dict.fromkeys(department_ids))
    query = select(Department.id, Department.laboratory_id).where(Department.id.in_(unique_ids))
    query = filter_not_deleted_unless(query, Department.deleted_at, include_deleted)
    result = await db.execute(query)
    return {int(row[0]): int(row[1]) for row in result.all()}
