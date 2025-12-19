from typing import List, Optional
from sqlalchemy import delete, func, insert, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.exceptions import ConflictError, NotFoundError, ValidationError
from core.logger import logger
from models.laboratory import Department, Laboratory
from models.research import (
    ResearchMethod,
    ResearchMethodGroup,
    research_method_groups_association,
)
from schemas.research import (
    ResearchMethodCreate,
    ResearchMethodGroupCreate,
    ResearchMethodGroupUpdate,
    ResearchMethodSortOrderUpdate,
    ResearchMethodUpdate,
    SortOrderBatchUpdate,
    SortOrderBatchUpdateItem,
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
            selectinload(ResearchMethod.groups),
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
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    rounding_type: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[ResearchMethod], int, int]:
    """Получить список методов исследования."""
    query = (
        select(ResearchMethod)
        .where(ResearchMethod.deleted_at.is_(None))
        .options(
            selectinload(ResearchMethod.laboratory),
            selectinload(ResearchMethod.department),
            selectinload(ResearchMethod.groups),
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

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
        query = apply_pagination(query, page, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    result = await db.execute(query)
    methods = result.scalars().all()

    return methods, total, total_pages


async def _get_max_sort_order(db: AsyncSession) -> int:
    """Получить максимальный sort_order среди методов и групп."""
    max_method_sort_order = await db.execute(
        select(func.max(ResearchMethod.sort_order)).where(
            ResearchMethod.deleted_at.is_(None),
            ResearchMethod.is_group_member == False,
        )
    )
    max_group_sort_order = await db.execute(
        select(func.max(ResearchMethodGroup.sort_order)).where(
            ResearchMethodGroup.deleted_at.is_(None)
        )
    )
    max_method = max_method_sort_order.scalar() or 0
    max_group = max_group_sort_order.scalar() or 0
    return max(max_method, max_group)


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

    sort_order = method_data.sort_order
    if sort_order is None and not method_data.is_group_member:
        sort_order = await _get_max_sort_order(db) + 1

    if sort_order is not None and not method_data.is_group_member:
        await _resolve_sort_order_conflict(db, sort_order)

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
        sort_order=sort_order,
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


async def _resolve_sort_order_conflict(
    db: AsyncSession,
    new_sort_order: int,
    old_sort_order: Optional[int] = None,
    exclude_method_id: Optional[int] = None,
    exclude_group_id: Optional[int] = None,
) -> None:
    """Решение конфликта sort_order между методами и группами.

    Если новый sort_order занят другим элементом, меняет их местами.
    Использует SELECT FOR UPDATE для защиты от гонок.
    """
    if old_sort_order == new_sort_order:
        return

    method_conditions = [
        ResearchMethod.sort_order == new_sort_order,
        ResearchMethod.deleted_at.is_(None),
        ResearchMethod.is_group_member == False,
    ]
    if exclude_method_id is not None:
        method_conditions.append(ResearchMethod.id != exclude_method_id)

    conflicting_method = await db.execute(
        select(ResearchMethod).where(*method_conditions).with_for_update()
    )
    conflicting_method_obj = conflicting_method.scalar_one_or_none()

    group_conditions = [
        ResearchMethodGroup.sort_order == new_sort_order,
        ResearchMethodGroup.deleted_at.is_(None),
    ]
    if exclude_group_id is not None:
        group_conditions.append(ResearchMethodGroup.id != exclude_group_id)

    conflicting_group = await db.execute(
        select(ResearchMethodGroup).where(*group_conditions).with_for_update()
    )
    conflicting_group_obj = conflicting_group.scalar_one_or_none()

    has_conflict = (
        conflicting_method_obj is not None or conflicting_group_obj is not None
    )
    if has_conflict:
        logger.info(
            f"Обнаружен конфликт sort_order: new={new_sort_order}, old={old_sort_order}, "
            f"conflicting_method_id={conflicting_method_obj.id if conflicting_method_obj else None}, "
            f"conflicting_group_id={conflicting_group_obj.id if conflicting_group_obj else None}"
        )

    if conflicting_method_obj:
        if old_sort_order is not None:
            logger.info(
                f"Меняем местами метод: method_id={conflicting_method_obj.id}, "
                f"old_sort_order={conflicting_method_obj.sort_order} -> {old_sort_order}"
            )
            conflicting_method_obj.sort_order = old_sort_order
        else:
            new_max_sort_order = await _get_max_sort_order(db)
            conflicting_method_obj.sort_order = new_max_sort_order + 1
            logger.info(
                f"Перемещаем метод в конец: method_id={conflicting_method_obj.id}, "
                f"new_sort_order={conflicting_method_obj.sort_order}"
            )
        await db.flush()

    if conflicting_group_obj:
        if old_sort_order is not None:
            logger.info(
                f"Меняем местами группу: group_id={conflicting_group_obj.id}, "
                f"old_sort_order={conflicting_group_obj.sort_order} -> {old_sort_order}"
            )
            conflicting_group_obj.sort_order = old_sort_order
        else:
            new_max_sort_order = await _get_max_sort_order(db)
            conflicting_group_obj.sort_order = new_max_sort_order + 1
            logger.info(
                f"Перемещаем группу в конец: group_id={conflicting_group_obj.id}, "
                f"new_sort_order={conflicting_group_obj.sort_order}"
            )
        await db.flush()

    if conflicting_method_obj and conflicting_group_obj:
        logger.warning(
            f"Одновременный конфликт метода и группы: method_id={conflicting_method_obj.id}, "
            f"group_id={conflicting_group_obj.id}, sort_order={new_sort_order}. "
            f"Оба элемента обработаны."
        )


async def update_research_method_sort_order(
    db: AsyncSession, method_id: int, sort_data: ResearchMethodSortOrderUpdate
) -> ResearchMethod:
    """Обновить порядок сортировки метода исследования."""
    method = await get_research_method_by_id(db, method_id)
    if not method:
        raise NotFoundError("Метод исследования не найден")

    if method.is_group_member:
        raise ValidationError(
            "Нельзя изменить sort_order для метода, входящего в группу"
        )

    old_sort_order = method.sort_order
    await _resolve_sort_order_conflict(
        db,
        sort_data.sort_order,
        old_sort_order=old_sort_order,
        exclude_method_id=method_id,
    )
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
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[ResearchMethodGroup], int, int]:
    """Получить список групп методов исследования."""
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

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
        query = apply_pagination(query, page, page_size)
    else:
        total_pages = 1 if total > 0 else 0

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

    sort_order = group_data.sort_order
    if sort_order is None:
        sort_order = await _get_max_sort_order(db) + 1

    if sort_order is not None:
        await _resolve_sort_order_conflict(db, sort_order)

    group = ResearchMethodGroup(
        name=group_data.name.strip(),
        sort_order=sort_order,
    )
    db.add(group)
    await db.flush()

    for method in methods_list:
        method.is_group_member = True

    if methods_list:
        await db.execute(
            insert(research_method_groups_association).values(
                [
                    {
                        "research_method_id": method.id,
                        "research_method_group_id": group.id,
                    }
                    for method in methods_list
                ]
            )
        )

    await db.flush()
    result = await db.execute(
        select(ResearchMethodGroup)
        .where(ResearchMethodGroup.id == group.id)
        .options(selectinload(ResearchMethodGroup.methods))
    )
    group = result.scalar_one()
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
        old_sort_order = group.sort_order
        await _resolve_sort_order_conflict(
            db,
            group_data.sort_order,
            old_sort_order=old_sort_order,
            exclude_group_id=group_id,
        )
        group.sort_order = group_data.sort_order
    elif group.sort_order is None:
        group.sort_order = await _get_max_sort_order(db) + 1

    if group_data.method_ids is not None:
        if not group_data.method_ids:
            raise ValidationError("Необходимо выбрать хотя бы один метод")

        old_method_ids = {method.id for method in group.methods}
        new_method_ids = set(group_data.method_ids)

        methods_to_remove = old_method_ids - new_method_ids
        methods_to_add = new_method_ids - old_method_ids

        if methods_to_remove:
            methods_to_remove_list = await db.execute(
                select(ResearchMethod).where(
                    ResearchMethod.id.in_(list(methods_to_remove))
                )
            )
            for method in methods_to_remove_list.scalars().all():
                method.is_group_member = False

            await db.execute(
                delete(research_method_groups_association).where(
                    research_method_groups_association.c.research_method_group_id
                    == group.id,
                    research_method_groups_association.c.research_method_id.in_(
                        list(methods_to_remove)
                    ),
                )
            )

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

            await db.execute(
                insert(research_method_groups_association).values(
                    [
                        {
                            "research_method_id": method.id,
                            "research_method_group_id": group.id,
                        }
                        for method in methods_list
                    ]
                )
            )

    await db.flush()
    result = await db.execute(
        select(ResearchMethodGroup)
        .where(ResearchMethodGroup.id == group.id)
        .options(selectinload(ResearchMethodGroup.methods))
    )
    group = result.scalar_one()
    return group


async def delete_research_method_group(db: AsyncSession, group_id: int) -> None:
    """Удалить группу методов исследования (мягкое удаление)."""
    group = await get_research_method_group_by_id(db, group_id)
    if not group:
        raise NotFoundError("Группа методов исследования не найдена")

    if group.methods:
        for method in group.methods:
            method.is_group_member = False
            method.soft_delete()

    group.soft_delete()
    await db.flush()


async def batch_update_sort_order(
    db: AsyncSession, batch_data: SortOrderBatchUpdate
) -> None:
    """Массовое обновление sort_order для методов и групп."""
    methods_to_update: List[tuple[int, int]] = []
    groups_to_update: List[tuple[int, int]] = []

    for item in batch_data.items:
        if item.type == "method":
            methods_to_update.append((item.id, item.sort_order))
        elif item.type == "group":
            groups_to_update.append((item.id, item.sort_order))
        else:
            raise ValidationError(f"Неизвестный тип элемента: {item.type}")

    for method_id, new_sort_order in methods_to_update:
        method = await get_research_method_by_id(db, method_id)
        if not method:
            raise NotFoundError(f"Метод исследования с ID {method_id} не найден")
        if method.is_group_member:
            raise ValidationError(
                f"Нельзя изменить sort_order для метода {method_id}, входящего в группу"
            )

        old_sort_order = method.sort_order
        await _resolve_sort_order_conflict(
            db,
            new_sort_order,
            old_sort_order=old_sort_order,
            exclude_method_id=method_id,
        )
        method.sort_order = new_sort_order

    for group_id, new_sort_order in groups_to_update:
        group = await get_research_method_group_by_id(db, group_id)
        if not group:
            raise NotFoundError(
                f"Группа методов исследования с ID {group_id} не найдена"
            )

        old_sort_order = group.sort_order
        await _resolve_sort_order_conflict(
            db,
            new_sort_order,
            old_sort_order=old_sort_order,
            exclude_group_id=group_id,
        )
        group.sort_order = new_sort_order

    await db.flush()
