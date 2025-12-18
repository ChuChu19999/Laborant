from typing import Optional
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.exceptions import ConflictError, NotFoundError, ValidationError
from models.laboratory import Branch, Department, Laboratory, SamplingLocation
from schemas.laboratory import (
    BranchCreate,
    BranchUpdate,
    DepartmentCreate,
    DepartmentUpdate,
    LaboratoryCreate,
    LaboratoryUpdate,
    SamplingLocationCreate,
    SamplingLocationUpdate,
)
from utils.filters import add_text_search_filter
from utils.pagination import apply_pagination, calculate_total_pages, get_total_count
from utils.sorting import build_order_by


async def get_laboratory_by_id(
    db: AsyncSession, laboratory_id: int, include_deleted: bool = False
) -> Optional[Laboratory]:
    """Получить лабораторию по ID."""
    query = select(Laboratory).where(Laboratory.id == laboratory_id)
    if not include_deleted:
        query = query.where(Laboratory.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_laboratories(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[list[Laboratory], int, int]:
    """Получить список лабораторий с пагинацией."""
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
    total_pages = calculate_total_pages(total, page_size)

    query = apply_pagination(query, page, page_size)
    result = await db.execute(query)
    laboratories = result.scalars().all()

    return laboratories, total, total_pages


async def create_laboratory(
    db: AsyncSession, laboratory_data: LaboratoryCreate
) -> Laboratory:
    """Создать лабораторию."""
    existing = await db.execute(
        select(Laboratory).where(
            Laboratory.name == laboratory_data.name,
            Laboratory.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError("Лаборатория с таким названием уже существует")

    laboratory = Laboratory(
        name=laboratory_data.name.strip(),
        full_name=laboratory_data.full_name.strip(),
        laboratory_location=(
            laboratory_data.laboratory_location.strip()
            if laboratory_data.laboratory_location
            else None
        ),
    )
    db.add(laboratory)
    await db.flush()
    return laboratory


async def update_laboratory(
    db: AsyncSession, laboratory_id: int, laboratory_data: LaboratoryUpdate
) -> Laboratory:
    """Обновить лабораторию."""
    laboratory = await get_laboratory_by_id(db, laboratory_id)
    if not laboratory:
        raise NotFoundError("Лаборатория не найдена")

    if laboratory_data.name is not None:
        existing = await db.execute(
            select(Laboratory).where(
                Laboratory.name == laboratory_data.name.strip(),
                Laboratory.id != laboratory_id,
                Laboratory.deleted_at.is_(None),
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictError("Лаборатория с таким названием уже существует")
        laboratory.name = laboratory_data.name.strip()

    if laboratory_data.full_name is not None:
        laboratory.full_name = laboratory_data.full_name.strip()

    if laboratory_data.laboratory_location is not None:
        laboratory.laboratory_location = laboratory_data.laboratory_location.strip()

    await db.flush()
    return laboratory


async def delete_laboratory(db: AsyncSession, laboratory_id: int) -> None:
    """Удалить лабораторию (мягкое удаление)."""
    query = (
        select(Laboratory)
        .where(Laboratory.id == laboratory_id)
        .options(selectinload(Laboratory.departments))
    )
    result = await db.execute(query)
    laboratory = result.scalar_one_or_none()

    if not laboratory:
        raise NotFoundError("Лаборатория не найдена")

    # Помечаем все подразделения как удаленные
    for department in laboratory.departments:
        if department.deleted_at is None:
            department.soft_delete()

    # Помечаем саму лабораторию как удаленную
    laboratory.soft_delete()
    await db.flush()


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
        query = query.where(Department.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_departments(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[list[Department], int, int]:
    """Получить список подразделений с пагинацией."""
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
    total_pages = calculate_total_pages(total, page_size)

    query = apply_pagination(query, page, page_size)
    result = await db.execute(query)
    departments = result.scalars().all()

    return departments, total, total_pages


async def create_department(
    db: AsyncSession, department_data: DepartmentCreate
) -> Department:
    """Создать подразделение."""
    laboratory = await get_laboratory_by_id(db, department_data.laboratory_id)
    if not laboratory:
        raise NotFoundError("Лаборатория не найдена")

    existing = await db.execute(
        select(Department).where(
            Department.laboratory_id == department_data.laboratory_id,
            Department.name == department_data.name.strip(),
            Department.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError(
            "Подразделение с таким названием уже существует для данной лаборатории"
        )

    department = Department(
        laboratory_id=department_data.laboratory_id,
        name=department_data.name.strip(),
        laboratory_location=department_data.laboratory_location.strip(),
    )
    db.add(department)
    await db.flush()
    return department


async def update_department(
    db: AsyncSession, department_id: int, department_data: DepartmentUpdate
) -> Department:
    """Обновить подразделение."""
    department = await get_department_by_id(db, department_id)
    if not department:
        raise NotFoundError("Подразделение не найдено")

    if department_data.name is not None:
        existing = await db.execute(
            select(Department).where(
                Department.laboratory_id == department.laboratory_id,
                Department.name == department_data.name.strip(),
                Department.id != department_id,
                Department.deleted_at.is_(None),
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictError(
                "Подразделение с таким названием уже существует для данной лаборатории"
            )
        department.name = department_data.name.strip()

    if department_data.laboratory_location is not None:
        department.laboratory_location = department_data.laboratory_location.strip()

    await db.flush()
    return department


async def delete_department(db: AsyncSession, department_id: int) -> None:
    """Удалить подразделение (мягкое удаление)."""
    department = await get_department_by_id(db, department_id)
    if not department:
        raise NotFoundError("Подразделение не найдено")

    department.soft_delete()
    await db.flush()


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
        query = query.where(Branch.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_branches(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[list[Branch], int, int]:
    """Получить список филиалов с пагинацией."""
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

    count_query = (
        select(func.count()).select_from(Branch).where(Branch.deleted_at.is_(None))
    )
    count_conditions = []
    if laboratory_id:
        count_conditions.append(Branch.laboratory_id == laboratory_id)
    if department_id:
        count_conditions.append(Branch.department_id == department_id)
    if search:
        add_text_search_filter(count_conditions, search, Branch.name)
    if count_conditions:
        count_query = count_query.where(*count_conditions)

    total = await get_total_count(db, count_query)
    total_pages = calculate_total_pages(total, page_size)

    query = apply_pagination(query, page, page_size)
    result = await db.execute(query)
    branches = result.scalars().all()

    return branches, total, total_pages


async def create_branch(db: AsyncSession, branch_data: BranchCreate) -> Branch:
    """Создать филиал."""
    laboratory = await get_laboratory_by_id(db, branch_data.laboratory_id)
    if not laboratory:
        raise NotFoundError("Лаборатория не найдена")

    if branch_data.department_id:
        department = await get_department_by_id(db, branch_data.department_id)
        if not department:
            raise NotFoundError("Подразделение не найдено")
        if department.laboratory_id != branch_data.laboratory_id:
            raise ValidationError(
                "Подразделение должно принадлежать выбранной лаборатории"
            )

    branch = Branch(
        name=branch_data.name.strip(),
        phone=branch_data.phone.strip() if branch_data.phone else None,
        laboratory_id=branch_data.laboratory_id,
        department_id=branch_data.department_id,
    )
    db.add(branch)
    await db.flush()
    return branch


async def update_branch(
    db: AsyncSession, branch_id: int, branch_data: BranchUpdate
) -> Branch:
    """Обновить филиал."""
    branch = await get_branch_by_id(db, branch_id)
    if not branch:
        raise NotFoundError("Филиал не найден")

    if branch_data.name is not None:
        branch.name = branch_data.name.strip()
    if branch_data.phone is not None:
        branch.phone = branch_data.phone.strip() if branch_data.phone else None

    await db.flush()
    return branch


async def delete_branch(db: AsyncSession, branch_id: int) -> None:
    """Удалить филиал (мягкое удаление)."""
    branch = await get_branch_by_id(db, branch_id)
    if not branch:
        raise NotFoundError("Филиал не найден")

    branch.soft_delete()
    await db.flush()


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
        query = query.where(SamplingLocation.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_sampling_locations(
    db: AsyncSession,
    branch_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[list[SamplingLocation], int, int]:
    """Получить список мест отбора проб с пагинацией."""
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

    count_query = (
        select(func.count())
        .select_from(SamplingLocation)
        .where(SamplingLocation.deleted_at.is_(None))
    )
    count_conditions = []
    if branch_id:
        count_conditions.append(SamplingLocation.branch_id == branch_id)
    if search:
        add_text_search_filter(count_conditions, search, SamplingLocation.name)
    if count_conditions:
        count_query = count_query.where(*count_conditions)

    total = await get_total_count(db, count_query)
    total_pages = calculate_total_pages(total, page_size)

    query = apply_pagination(query, page, page_size)
    result = await db.execute(query)
    sampling_locations = result.scalars().all()

    return sampling_locations, total, total_pages


async def create_sampling_location(
    db: AsyncSession, sampling_location_data: SamplingLocationCreate
) -> SamplingLocation:
    """Создать место отбора пробы."""
    branch = await get_branch_by_id(db, sampling_location_data.branch_id)
    if not branch:
        raise NotFoundError("Филиал не найден")

    existing = await db.execute(
        select(SamplingLocation).where(
            SamplingLocation.branch_id == sampling_location_data.branch_id,
            SamplingLocation.name == sampling_location_data.name.strip(),
            SamplingLocation.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError(
            "Место отбора пробы с таким названием уже существует для данного филиала"
        )

    sampling_location = SamplingLocation(
        branch_id=sampling_location_data.branch_id,
        name=sampling_location_data.name.strip(),
    )
    db.add(sampling_location)
    await db.flush()
    return sampling_location


async def update_sampling_location(
    db: AsyncSession,
    sampling_location_id: int,
    sampling_location_data: SamplingLocationUpdate,
) -> SamplingLocation:
    """Обновить место отбора пробы."""
    sampling_location = await get_sampling_location_by_id(db, sampling_location_id)
    if not sampling_location:
        raise NotFoundError("Место отбора пробы не найдено")

    if sampling_location_data.name is not None:
        existing = await db.execute(
            select(SamplingLocation).where(
                SamplingLocation.branch_id == sampling_location.branch_id,
                SamplingLocation.name == sampling_location_data.name.strip(),
                SamplingLocation.id != sampling_location_id,
                SamplingLocation.deleted_at.is_(None),
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictError(
                "Место отбора пробы с таким названием уже существует для данного филиала"
            )
        sampling_location.name = sampling_location_data.name.strip()

    await db.flush()
    return sampling_location


async def delete_sampling_location(db: AsyncSession, sampling_location_id: int) -> None:
    """Удалить место отбора пробы (мягкое удаление)."""
    sampling_location = await get_sampling_location_by_id(db, sampling_location_id)
    if not sampling_location:
        raise NotFoundError("Место отбора пробы не найдено")

    sampling_location.soft_delete()
    await db.flush()
