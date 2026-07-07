from __future__ import annotations
from typing import Optional
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from models.laboratory import Branch, Department, Laboratory, SamplingLocation, WellMode
from repositories.base import (
    add_and_flush,
    execute_scalar_one_or_none,
    execute_scalars_all,
    filter_not_deleted,
)
from utils.filters import add_text_search_filter
from utils.pagination import apply_pagination, get_total_count
from utils.sorting import build_order_by


async def get_laboratory_by_id(
    db: AsyncSession, laboratory_id: int, include_deleted: bool = False
) -> Optional[Laboratory]:
    """Получить лабораторию по ID."""
    query = select(Laboratory).where(Laboratory.id == laboratory_id)
    if not include_deleted:
        query = filter_not_deleted(query, Laboratory.deleted_at)
    return await execute_scalar_one_or_none(db, query)


async def get_laboratories(
    db: AsyncSession,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[list[Laboratory], int]:
    """Получить список лабораторий."""
    query = (
        select(Laboratory)
        .where(Laboratory.deleted_at.is_(None))
        .options(selectinload(Laboratory.departments))
    )

    if search:
        query = query.where(
            or_(
                Laboratory.name.ilike(f"%{search}%"),
                Laboratory.full_name.ilike(f"%{search}%"),
            )
        )

    sort_mapping = {
        "name": Laboratory.name,
        "full_name": Laboratory.full_name,
        "created_at": Laboratory.created_at,
    }
    order_by = build_order_by(
        sort_by, sort_order, sort_mapping, Laboratory.name, default_order="asc"
    )
    query = query.order_by(order_by)

    count_query = (
        select(func.count())
        .select_from(Laboratory)
        .where(Laboratory.deleted_at.is_(None))
    )
    if search:
        count_query = count_query.where(
            or_(
                Laboratory.name.ilike(f"%{search}%"),
                Laboratory.full_name.ilike(f"%{search}%"),
            )
        )

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    laboratories = await execute_scalars_all(db, query)
    return laboratories, total


async def exists_laboratory_by_name(
    db: AsyncSession,
    name: str,
    exclude_id: Optional[int] = None,
) -> bool:
    """Проверить существование лаборатории с таким названием."""
    conditions = [
        Laboratory.name == name.strip(),
        Laboratory.deleted_at.is_(None),
    ]
    if exclude_id is not None:
        conditions.append(Laboratory.id != exclude_id)

    query = select(Laboratory).where(*conditions)
    existing = await execute_scalar_one_or_none(db, query)
    return existing is not None


async def add_laboratory(db: AsyncSession, laboratory: Laboratory) -> Laboratory:
    """Добавить лабораторию в сессию."""
    await add_and_flush(db, laboratory)
    return laboratory


async def get_laboratory_with_departments_for_delete(
    db: AsyncSession,
    laboratory_id: int,
) -> Optional[Laboratory]:
    """Получить лабораторию с подразделениями для удаления."""
    query = (
        select(Laboratory)
        .where(Laboratory.id == laboratory_id)
        .options(selectinload(Laboratory.departments))
    )
    return await execute_scalar_one_or_none(db, query)


async def get_department_by_id(
    db: AsyncSession, department_id: int, include_deleted: bool = False
) -> Optional[Department]:
    """Получить подразделение по ID."""
    query = (
        select(Department)
        .where(Department.id == department_id)
        .options(selectinload(Department.laboratory))
    )
    if not include_deleted:
        query = filter_not_deleted(query, Department.deleted_at)
    return await execute_scalar_one_or_none(db, query)


async def get_departments(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[list[Department], int]:
    """Получить список подразделений."""
    query = (
        select(Department)
        .where(Department.deleted_at.is_(None))
        .options(selectinload(Department.laboratory))
    )

    if laboratory_id:
        query = query.where(Department.laboratory_id == laboratory_id)

    conditions = []
    if search:
        add_text_search_filter(conditions, search, Department.name)
    if conditions:
        query = query.where(*conditions)

    sort_mapping = {
        "name": Department.name,
        "created_at": Department.created_at,
    }
    order_by = build_order_by(
        sort_by, sort_order, sort_mapping, Department.name, default_order="asc"
    )
    query = query.order_by(order_by)

    count_query = (
        select(func.count())
        .select_from(Department)
        .where(Department.deleted_at.is_(None))
    )
    count_conditions = []
    if laboratory_id:
        count_conditions.append(Department.laboratory_id == laboratory_id)
    if search:
        add_text_search_filter(count_conditions, search, Department.name)
    if count_conditions:
        count_query = count_query.where(*count_conditions)

    total = await get_total_count(db, count_query)

    if page is not None and page_size is not None:
        query = apply_pagination(query, page, page_size)

    departments = await execute_scalars_all(db, query)
    return departments, total


async def exists_department_by_name_and_laboratory(
    db: AsyncSession,
    laboratory_id: int,
    name: str,
    exclude_id: Optional[int] = None,
) -> bool:
    """Проверить существование подразделения с таким названием в лаборатории."""
    conditions = [
        Department.laboratory_id == laboratory_id,
        Department.name == name.strip(),
        Department.deleted_at.is_(None),
    ]
    if exclude_id is not None:
        conditions.append(Department.id != exclude_id)

    query = select(Department).where(*conditions)
    existing = await execute_scalar_one_or_none(db, query)
    return existing is not None


async def add_department(db: AsyncSession, department: Department) -> Department:
    """Добавить подразделение в сессию."""
    await add_and_flush(db, department)
    return department


async def get_branch_by_id(
    db: AsyncSession, branch_id: int, include_deleted: bool = False
) -> Optional[Branch]:
    """Получить филиал по ID."""
    query = (
        select(Branch)
        .where(Branch.id == branch_id)
        .options(selectinload(Branch.laboratory), selectinload(Branch.department))
    )
    if not include_deleted:
        query = filter_not_deleted(query, Branch.deleted_at)
    return await execute_scalar_one_or_none(db, query)


async def get_branches(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> list[Branch]:
    """Получить список филиалов."""
    query = (
        select(Branch)
        .where(Branch.deleted_at.is_(None))
        .options(selectinload(Branch.laboratory), selectinload(Branch.department))
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

    return await execute_scalars_all(db, query)


async def add_branch(db: AsyncSession, branch: Branch) -> Branch:
    """Добавить филиал в сессию."""
    await add_and_flush(db, branch)
    return branch


async def get_branch_with_sampling_locations_for_delete(
    db: AsyncSession,
    branch_id: int,
) -> Optional[Branch]:
    """Получить филиал с местами отбора для удаления."""
    query = (
        select(Branch)
        .where(Branch.id == branch_id)
        .options(selectinload(Branch.sampling_locations))
    )
    return await execute_scalar_one_or_none(db, query)


async def get_sampling_location_by_id(
    db: AsyncSession, sampling_location_id: int, include_deleted: bool = False
) -> Optional[SamplingLocation]:
    """Получить место отбора пробы по ID."""
    query = (
        select(SamplingLocation)
        .where(SamplingLocation.id == sampling_location_id)
        .options(selectinload(SamplingLocation.branch))
    )
    if not include_deleted:
        query = filter_not_deleted(query, SamplingLocation.deleted_at)
    return await execute_scalar_one_or_none(db, query)


async def get_sampling_locations(
    db: AsyncSession,
    branch_id: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> list[SamplingLocation]:
    """Получить список мест отбора проб."""
    query = (
        select(SamplingLocation)
        .where(SamplingLocation.deleted_at.is_(None))
        .options(selectinload(SamplingLocation.branch))
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
    order_by = build_order_by(
        sort_by, sort_order, sort_mapping, SamplingLocation.created_at
    )
    query = query.order_by(order_by)

    return await execute_scalars_all(db, query)


async def exists_sampling_location_by_name_and_branch(
    db: AsyncSession,
    branch_id: int,
    name: str,
    exclude_id: Optional[int] = None,
) -> bool:
    """Проверить существование места отбора с таким названием в филиале."""
    conditions = [
        SamplingLocation.branch_id == branch_id,
        SamplingLocation.name == name.strip(),
        SamplingLocation.deleted_at.is_(None),
    ]
    if exclude_id is not None:
        conditions.append(SamplingLocation.id != exclude_id)

    query = select(SamplingLocation).where(*conditions)
    existing = await execute_scalar_one_or_none(db, query)
    return existing is not None


async def add_sampling_location(
    db: AsyncSession, sampling_location: SamplingLocation
) -> SamplingLocation:
    """Добавить место отбора пробы в сессию."""
    await add_and_flush(db, sampling_location)
    return sampling_location


async def get_well_mode_by_id(
    db: AsyncSession, well_mode_id: int, include_deleted: bool = False
) -> Optional[WellMode]:
    """Получить режим скважины по ID."""
    query = (
        select(WellMode)
        .where(WellMode.id == well_mode_id)
        .options(selectinload(WellMode.branch))
    )
    if not include_deleted:
        query = filter_not_deleted(query, WellMode.deleted_at)
    return await execute_scalar_one_or_none(db, query)


async def get_well_modes(
    db: AsyncSession,
    branch_id: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> list[WellMode]:
    """Получить список режимов скважин."""
    query = (
        select(WellMode)
        .where(WellMode.deleted_at.is_(None))
        .options(selectinload(WellMode.branch))
    )

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

    return await execute_scalars_all(db, query)


async def get_laboratory_id_by_name(db: AsyncSession, name: str) -> int | None:
    """Получить ID лаборатории по точному наименованию."""
    query = select(Laboratory.id).where(
        Laboratory.name == name,
        Laboratory.deleted_at.is_(None),
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def exists_well_mode_by_name_and_branch(
    db: AsyncSession,
    branch_id: int,
    name: str,
    exclude_id: Optional[int] = None,
) -> bool:
    """Проверить существование режима скважины с таким названием в филиале."""
    conditions = [
        WellMode.branch_id == branch_id,
        WellMode.name == name.strip(),
        WellMode.deleted_at.is_(None),
    ]
    if exclude_id is not None:
        conditions.append(WellMode.id != exclude_id)

    query = select(WellMode).where(*conditions)
    existing = await execute_scalar_one_or_none(db, query)
    return existing is not None


async def add_well_mode(db: AsyncSession, well_mode: WellMode) -> WellMode:
    """Добавить режим скважины в сессию."""
    await add_and_flush(db, well_mode)
    return well_mode
