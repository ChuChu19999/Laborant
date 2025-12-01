from typing import List, Optional
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.exceptions import ConflictError, NotFoundError, ValidationError
from models.laboratory import Department, Laboratory
from models.research import ResearchMethod, ResearchMethodGroup
from schemas.research import (
    ResearchMethodCreate,
    ResearchMethodGroupCreate,
    ResearchMethodGroupUpdate,
    ResearchMethodSortOrderUpdate,
    ResearchMethodUpdate,
)
from utils.filters import add_list_filter, add_text_search_filter
from utils.pagination import apply_pagination, calculate_total_pages, get_total_count
from utils.sorting import build_order_by


async def get_research_method_by_id(
    db: AsyncSession, method_id: int, include_deleted: bool = False
) -> Optional[ResearchMethod]:
    """Получить метод исследования по ID."""
    query = (
        select(ResearchMethod)
        .where(ResearchMethod.id == method_id)
        .options(
            selectinload(ResearchMethod.laboratory),
            selectinload(ResearchMethod.department),
        )
    )
    if not include_deleted:
        query = query.where(ResearchMethod.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_research_methods(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    rounding_type: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[ResearchMethod], int, int]:
    """Получить список методов исследования с пагинацией."""
    query = (
        select(ResearchMethod)
        .where(ResearchMethod.deleted_at.is_(None))
        .options(
            selectinload(ResearchMethod.laboratory),
            selectinload(ResearchMethod.department),
        )
    )

    conditions = []
    if laboratory_id:
        conditions.append(ResearchMethod.laboratory_id == laboratory_id)
    if department_id:
        conditions.append(ResearchMethod.department_id == department_id)
    if rounding_type:
        conditions.append(ResearchMethod.rounding_type == rounding_type)
    if conditions:
        query = query.where(*conditions)

    if search:
        query = query.where(
            or_(
                ResearchMethod.name.ilike(f"%{search}%"),
                ResearchMethod.nd_code.ilike(f"%{search}%"),
                ResearchMethod.nd_name.ilike(f"%{search}%"),
            )
        )

    sort_mapping = {
        "name": ResearchMethod.name,
        "sort_order": ResearchMethod.sort_order,
        "created_at": ResearchMethod.created_at,
    }
    order_by = build_order_by(sort_by, sort_order, sort_mapping, ResearchMethod.name)
    query = query.order_by(order_by)

    count_query = (
        select(func.count())
        .select_from(ResearchMethod)
        .where(ResearchMethod.deleted_at.is_(None))
    )
    count_conditions = []
    if laboratory_id:
        count_conditions.append(ResearchMethod.laboratory_id == laboratory_id)
    if department_id:
        count_conditions.append(ResearchMethod.department_id == department_id)
    if rounding_type:
        count_conditions.append(ResearchMethod.rounding_type == rounding_type)
    if count_conditions:
        count_query = count_query.where(*count_conditions)
    if search:
        count_query = count_query.where(
            or_(
                ResearchMethod.name.ilike(f"%{search}%"),
                ResearchMethod.nd_code.ilike(f"%{search}%"),
                ResearchMethod.nd_name.ilike(f"%{search}%"),
            )
        )

    total = await get_total_count(db, count_query)
    total_pages = calculate_total_pages(total, page_size)

    query = apply_pagination(query, page, page_size)
    result = await db.execute(query)
    methods = result.scalars().all()

    return methods, total, total_pages


async def create_research_method(
    db: AsyncSession, method_data: ResearchMethodCreate
) -> ResearchMethod:
    """Создать метод исследования."""
    if method_data.laboratory_id:
        laboratory = await db.execute(
            select(Laboratory).where(Laboratory.id == method_data.laboratory_id)
        )
        if not laboratory.scalar_one_or_none():
            raise NotFoundError("Лаборатория не найдена")

    if method_data.department_id:
        department = await db.execute(
            select(Department).where(Department.id == method_data.department_id)
        )
        dept = department.scalar_one_or_none()
        if not dept:
            raise NotFoundError("Подразделение не найдено")
        if (
            method_data.laboratory_id
            and dept.laboratory_id != method_data.laboratory_id
        ):
            raise ValidationError(
                "Подразделение должно принадлежать выбранной лаборатории"
            )

    method = ResearchMethod(
        name=method_data.name,
        sample_type=method_data.sample_type,
        formula=method_data.formula,
        measurement_error=method_data.measurement_error,
        unit=method_data.unit,
        measurement_method=method_data.measurement_method,
        nd_code=method_data.nd_code,
        nd_name=method_data.nd_name,
        input_data=method_data.input_data,
        intermediate_data=method_data.intermediate_data,
        convergence_conditions=method_data.convergence_conditions,
        rounding_type=method_data.rounding_type,
        rounding_decimal=method_data.rounding_decimal,
        is_group_member=method_data.is_group_member,
        equipment_data_default=method_data.equipment_data_default or [],
        sort_order=method_data.sort_order,
        laboratory_id=method_data.laboratory_id,
        department_id=method_data.department_id,
    )
    db.add(method)
    await db.flush()
    return method


async def update_research_method(
    db: AsyncSession, method_id: int, method_data: ResearchMethodUpdate
) -> ResearchMethod:
    """Обновить метод исследования."""
    method = await get_research_method_by_id(db, method_id)
    if not method:
        raise NotFoundError("Метод исследования не найден")

    update_data = method_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(method, key, value)

    if method_data.laboratory_id is not None or method_data.department_id is not None:
        lab_id = (
            method_data.laboratory_id
            if method_data.laboratory_id is not None
            else method.laboratory_id
        )
        dept_id = (
            method_data.department_id
            if method_data.department_id is not None
            else method.department_id
        )

        if dept_id:
            department = await db.execute(
                select(Department).where(Department.id == dept_id)
            )
            dept = department.scalar_one_or_none()
            if not dept:
                raise NotFoundError("Подразделение не найдено")
            if lab_id and dept.laboratory_id != lab_id:
                raise ValidationError(
                    "Подразделение должно принадлежать выбранной лаборатории"
                )

    await db.flush()
    return method


async def delete_research_method(db: AsyncSession, method_id: int) -> None:
    """Удалить метод исследования (мягкое удаление)."""
    method = await get_research_method_by_id(db, method_id)
    if not method:
        raise NotFoundError("Метод исследования не найден")

    method.soft_delete()
    await db.flush()


async def update_research_method_sort_order(
    db: AsyncSession, method_id: int, sort_data: ResearchMethodSortOrderUpdate
) -> ResearchMethod:
    """Обновить порядок сортировки метода исследования."""
    method = await get_research_method_by_id(db, method_id)
    if not method:
        raise NotFoundError("Метод исследования не найден")

    method.sort_order = sort_data.sort_order
    await db.flush()
    return method


async def get_research_method_group_by_id(
    db: AsyncSession, group_id: int, include_deleted: bool = False
) -> Optional[ResearchMethodGroup]:
    """Получить группу методов исследования по ID."""
    query = (
        select(ResearchMethodGroup)
        .where(ResearchMethodGroup.id == group_id)
        .options(selectinload(ResearchMethodGroup.methods))
    )
    if not include_deleted:
        query = query.where(ResearchMethodGroup.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_research_method_groups(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[ResearchMethodGroup], int, int]:
    """Получить список групп методов исследования с пагинацией."""
    query = (
        select(ResearchMethodGroup)
        .where(ResearchMethodGroup.deleted_at.is_(None))
        .options(selectinload(ResearchMethodGroup.methods))
    )

    if search:
        query = query.where(ResearchMethodGroup.name.ilike(f"%{search}%"))

    sort_mapping = {
        "name": ResearchMethodGroup.name,
        "sort_order": ResearchMethodGroup.sort_order,
        "created_at": ResearchMethodGroup.created_at,
    }
    order_by = build_order_by(
        sort_by, sort_order, sort_mapping, ResearchMethodGroup.name
    )
    query = query.order_by(order_by)

    count_query = (
        select(func.count())
        .select_from(ResearchMethodGroup)
        .where(ResearchMethodGroup.deleted_at.is_(None))
    )
    if search:
        count_query = count_query.where(ResearchMethodGroup.name.ilike(f"%{search}%"))

    total = await get_total_count(db, count_query)
    total_pages = calculate_total_pages(total, page_size)

    query = apply_pagination(query, page, page_size)
    result = await db.execute(query)
    groups = result.scalars().all()

    return groups, total, total_pages


async def create_research_method_group(
    db: AsyncSession, group_data: ResearchMethodGroupCreate
) -> ResearchMethodGroup:
    """Создать группу методов исследования."""
    if not group_data.method_ids:
        raise ValidationError("Необходимо выбрать хотя бы один метод")

    methods = await db.execute(
        select(ResearchMethod).where(
            ResearchMethod.id.in_(group_data.method_ids),
            ResearchMethod.deleted_at.is_(None),
        )
    )
    methods_list = methods.scalars().all()

    if len(methods_list) != len(group_data.method_ids):
        raise NotFoundError("Один или несколько методов не найдены")

    for method in methods_list:
        if method.is_group_member:
            raise ConflictError(f"Метод '{method.name}' уже входит в другую группу")

    group = ResearchMethodGroup(
        name=group_data.name.strip(),
        sort_order=group_data.sort_order,
    )
    db.add(group)
    await db.flush()

    for method in methods_list:
        method.is_group_member = True
        group.methods.append(method)

    await db.flush()
    return group


async def update_research_method_group(
    db: AsyncSession, group_id: int, group_data: ResearchMethodGroupUpdate
) -> ResearchMethodGroup:
    """Обновить группу методов исследования."""
    group = await get_research_method_group_by_id(db, group_id)
    if not group:
        raise NotFoundError("Группа методов исследования не найдена")

    if group_data.name is not None:
        group.name = group_data.name.strip()

    if group_data.sort_order is not None:
        group.sort_order = group_data.sort_order

    if group_data.method_ids is not None:
        if not group_data.method_ids:
            raise ValidationError("Необходимо выбрать хотя бы один метод")

        old_method_ids = {method.id for method in group.methods}
        new_method_ids = set(group_data.method_ids)

        methods_to_remove = old_method_ids - new_method_ids
        methods_to_add = new_method_ids - old_method_ids

        if methods_to_add:
            methods = await db.execute(
                select(ResearchMethod).where(
                    ResearchMethod.id.in_(list(methods_to_add)),
                    ResearchMethod.deleted_at.is_(None),
                )
            )
            methods_list = methods.scalars().all()

            if len(methods_list) != len(methods_to_add):
                raise NotFoundError("Один или несколько методов не найдены")

            for method in methods_list:
                if method.is_group_member and method.id not in old_method_ids:
                    raise ConflictError(
                        f"Метод '{method.name}' уже входит в другую группу"
                    )
                method.is_group_member = True
                group.methods.append(method)

        if methods_to_remove:
            methods_to_remove_list = await db.execute(
                select(ResearchMethod).where(
                    ResearchMethod.id.in_(list(methods_to_remove))
                )
            )
            for method in methods_to_remove_list.scalars().all():
                method.is_group_member = False
                group.methods.remove(method)

    await db.flush()
    return group


async def delete_research_method_group(db: AsyncSession, group_id: int) -> None:
    """Удалить группу методов исследования (мягкое удаление)."""
    group = await get_research_method_group_by_id(db, group_id)
    if not group:
        raise NotFoundError("Группа методов исследования не найдена")

    for method in group.methods:
        method.is_group_member = False

    group.soft_delete()
    await db.flush()
