from __future__ import annotations
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError, ValidationError
from core.logger import logger
from models.research import ResearchMethod, ResearchMethodGroup
from repositories import calculation as calculation_repo
from repositories import laboratory as laboratory_repo
from repositories import research as research_repo
from repositories.base import flush_entity
from schemas.research import (
    AvailableResearchMethodBrief,
    AvailableResearchMethodEntry,
    AvailableResearchMethodsResponse,
    ResearchMethodBrief,
    ResearchMethodCreate,
    ResearchMethodGroupCreate,
    ResearchMethodGroupResponse,
    ResearchMethodGroupUpdate,
    ResearchMethodResponse,
    ResearchMethodSortOrderUpdate,
    ResearchMethodUpdate,
    SortOrderBatchUpdate,
)
from services.sample import get_sample_by_id
from services.test_object import (
    resolve_tag_by_name,
    validate_research_method_sample_types,
)
from utils.pagination import calculate_total_pages


def build_research_method_group_response(
    group: ResearchMethodGroup,
) -> ResearchMethodGroupResponse:
    """Собрать ответ по группе без скрытых методов в списке members."""
    return ResearchMethodGroupResponse(
        id=group.id,
        name=group.name,
        sort_order=group.sort_order,
        created_at=group.created_at,
        deleted_at=group.deleted_at,
        methods=[
            ResearchMethodBrief(id=method.id, name=method.name)
            for method in group.methods
            if method.deleted_at is None
        ],
    )


def method_belongs_to_active_group(method: ResearchMethod) -> bool:
    """Проверить, входит ли метод в активную группу."""
    return any(group.deleted_at is None for group in (method.groups or []))


async def get_research_method_by_id(
    db: AsyncSession, method_id: int, include_deleted: bool = False
) -> Optional[ResearchMethod]:
    """Получить метод исследования по ID."""
    return await research_repo.get_research_method_by_id(db, method_id, include_deleted)


def build_research_method_display_name(
    method: ResearchMethod,
) -> str:
    """Собрать отображаемое имя методики с учётом активной группы."""
    base_name = method.name or ""
    if not method.is_group_member or not method.groups:
        return base_name

    active_group = next(
        (group for group in method.groups if group.deleted_at is None),
        None,
    )
    if not active_group:
        return base_name

    group_name = active_group.name
    if group_name == "Вязкость кинематическая":
        return f"{group_name} ({base_name.lower()})"
    return group_name


async def get_active_research_methods_by_name(
    db: AsyncSession,
    name: str,
    laboratory_id: int,
    department_id: Optional[int] = None,
    group_name: Optional[str] = None,
) -> List[ResearchMethod]:
    """Найти актуальные методики по имени в лаборатории и подразделении."""
    return await research_repo.get_active_research_methods_by_name(
        db, name, laboratory_id, department_id, group_name
    )


async def get_active_research_method_by_name(
    db: AsyncSession,
    name: str,
    laboratory_id: int,
    department_id: Optional[int] = None,
    group_name: Optional[str] = None,
) -> Optional[ResearchMethod]:
    """Найти единственную актуальную методику по имени в лаборатории и подразделении."""
    methods = await get_active_research_methods_by_name(
        db,
        name=name,
        laboratory_id=laboratory_id,
        department_id=department_id,
        group_name=group_name,
    )
    if len(methods) > 1:
        raise ValidationError(
            "Найдено несколько актуальных методик с одинаковым наименованием"
        )
    return methods[0] if methods else None


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
    methods, total = await research_repo.get_research_methods(
        db,
        laboratory_id,
        department_id,
        page,
        page_size,
        search,
        rounding_type,
        sort_by,
        sort_order,
    )

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    return methods, total, total_pages


async def create_research_method(
    db: AsyncSession, method_data: ResearchMethodCreate
) -> ResearchMethod:
    """Создать метод исследования."""
    if method_data.laboratory_id:
        if not await laboratory_repo.get_laboratory_by_id(
            db, method_data.laboratory_id
        ):
            raise NotFoundError("Лаборатория не найдена")

    if method_data.department_id:
        dept = await laboratory_repo.get_department_by_id(db, method_data.department_id)
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
        sort_order = await research_repo.get_max_sort_order(db) + 1

    if sort_order is not None and not method_data.is_group_member:
        await _resolve_sort_order_conflict(db, sort_order)

    await validate_research_method_sample_types(db, method_data.sample_type)

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
    return await research_repo.add_research_method(db, method)


async def update_research_method(
    db: AsyncSession, method_id: int, method_data: ResearchMethodUpdate
) -> ResearchMethod:
    """Обновить метод исследования."""
    method = await get_research_method_by_id(db, method_id)
    if not method:
        raise NotFoundError("Метод исследования не найден")

    if method_data.sample_type is not None:
        await validate_research_method_sample_types(db, method_data.sample_type)

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
            dept = await laboratory_repo.get_department_by_id(db, dept_id)
            if not dept:
                raise NotFoundError("Подразделение не найдено")
            if lab_id and dept.laboratory_id != lab_id:
                raise ValidationError(
                    "Подразделение должно принадлежать выбранной лаборатории"
                )

    await flush_entity(db)
    return method


async def delete_research_method(db: AsyncSession, method_id: int) -> None:
    """Удалить метод исследования (мягкое удаление)."""
    method = await get_research_method_by_id(db, method_id)
    if not method:
        raise NotFoundError("Метод исследования не найден")

    method.soft_delete()
    await flush_entity(db)


async def _resolve_sort_order_conflict(
    db: AsyncSession,
    new_sort_order: int,
    old_sort_order: Optional[int] = None,
    exclude_method_id: Optional[int] = None,
    exclude_group_id: Optional[int] = None,
) -> None:
    """Решение конфликта sort_order между методами и группами."""
    if old_sort_order == new_sort_order:
        return

    conflicting_method_obj = await research_repo.get_conflicting_method_by_sort_order(
        db, new_sort_order, exclude_method_id
    )
    conflicting_group_obj = await research_repo.get_conflicting_group_by_sort_order(
        db, new_sort_order, exclude_group_id
    )

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
            new_max_sort_order = await research_repo.get_max_sort_order(db)
            conflicting_method_obj.sort_order = new_max_sort_order + 1
            logger.info(
                f"Перемещаем метод в конец: method_id={conflicting_method_obj.id}, "
                f"new_sort_order={conflicting_method_obj.sort_order}"
            )
        await flush_entity(db)

    if conflicting_group_obj:
        if old_sort_order is not None:
            logger.info(
                f"Меняем местами группу: group_id={conflicting_group_obj.id}, "
                f"old_sort_order={conflicting_group_obj.sort_order} -> {old_sort_order}"
            )
            conflicting_group_obj.sort_order = old_sort_order
        else:
            new_max_sort_order = await research_repo.get_max_sort_order(db)
            conflicting_group_obj.sort_order = new_max_sort_order + 1
            logger.info(
                f"Перемещаем группу в конец: group_id={conflicting_group_obj.id}, "
                f"new_sort_order={conflicting_group_obj.sort_order}"
            )
        await flush_entity(db)

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
    await flush_entity(db)
    return method


async def get_research_method_group_by_id(
    db: AsyncSession, group_id: int, include_deleted: bool = False
) -> Optional[ResearchMethodGroup]:
    """Получить группу методов исследования по ID."""
    return await research_repo.get_research_method_group_by_id(
        db, group_id, include_deleted
    )


async def get_research_method_groups(
    db: AsyncSession,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> tuple[List[ResearchMethodGroup], int, int]:
    """Получить список групп методов исследования."""
    groups, total = await research_repo.get_research_method_groups(
        db, page, page_size, search, sort_by, sort_order
    )

    if page is not None and page_size is not None:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0

    return groups, total, total_pages


async def create_research_method_group(
    db: AsyncSession, group_data: ResearchMethodGroupCreate
) -> ResearchMethodGroup:
    """Создать группу методов исследования."""
    if not group_data.method_ids:
        raise ValidationError("Необходимо выбрать хотя бы один метод")

    methods_list = await research_repo.get_research_methods_by_ids(
        db, group_data.method_ids
    )

    if len(methods_list) != len(group_data.method_ids):
        raise NotFoundError("Один или несколько методов не найдены")

    for method in methods_list:
        if method_belongs_to_active_group(method):
            raise ConflictError(f"Метод '{method.name}' уже входит в другую группу")

    sort_order = group_data.sort_order
    if sort_order is None:
        sort_order = await research_repo.get_max_sort_order(db) + 1

    if sort_order is not None:
        await _resolve_sort_order_conflict(db, sort_order)

    group = ResearchMethodGroup(
        name=group_data.name.strip(),
        sort_order=sort_order,
    )
    group = await research_repo.add_research_method_group(db, group)

    for method in methods_list:
        method.is_group_member = True

    if methods_list:
        await research_repo.insert_method_group_associations(
            db, group.id, [method.id for method in methods_list]
        )

    await flush_entity(db)
    return await research_repo.get_research_method_group_by_id(db, group.id)


async def update_research_method_group(
    db: AsyncSession, group_id: int, group_data: ResearchMethodGroupUpdate
) -> ResearchMethodGroup:
    """Обновить группу методов исследования."""
    group = await get_research_method_group_by_id(db, group_id, include_deleted=True)
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
        group.sort_order = await research_repo.get_max_sort_order(db) + 1

    if group_data.method_ids is not None:
        if not group_data.method_ids:
            raise ValidationError("Необходимо выбрать хотя бы один метод")

        old_method_ids = {method.id for method in group.methods}
        new_method_ids = set(group_data.method_ids)

        methods_to_remove = old_method_ids - new_method_ids
        methods_to_add = new_method_ids - old_method_ids

        if methods_to_remove:
            for method in await research_repo.get_research_methods_by_ids_any(
                db, list(methods_to_remove)
            ):
                method.is_group_member = False

            await research_repo.delete_method_group_associations(
                db, group.id, list(methods_to_remove)
            )

        if methods_to_add:
            methods_list = await research_repo.get_research_methods_by_ids(
                db, list(methods_to_add)
            )

            if len(methods_list) != len(methods_to_add):
                raise NotFoundError("Один или несколько методов не найдены")

            for method in methods_list:
                if (
                    method_belongs_to_active_group(method)
                    and method.id not in old_method_ids
                ):
                    raise ConflictError(
                        f"Метод '{method.name}' уже входит в другую группу"
                    )
                method.is_group_member = True

            await research_repo.insert_method_group_associations(
                db, group.id, [method.id for method in methods_list]
            )

    await flush_entity(db)
    return await research_repo.get_research_method_group_by_id(db, group.id)


async def delete_research_method_group(db: AsyncSession, group_id: int) -> None:
    """Удалить группу методов исследования (мягкое удаление)."""
    group = await get_research_method_group_by_id(db, group_id)
    if not group:
        raise NotFoundError("Группа методов исследования не найдена")

    if group.methods:
        for method in group.methods:
            if method.deleted_at is None:
                method.soft_delete()

    group.soft_delete()
    await flush_entity(db)


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

    await flush_entity(db)


async def get_research_method_response_data(
    db: AsyncSession, method_id: int
) -> ResearchMethodResponse:
    """Получить метод исследования с данными для ответа API."""
    method = await research_repo.get_research_method_by_id(db, method_id)
    if not method:
        raise NotFoundError("Метод исследования не найден")
    return ResearchMethodResponse.model_validate(method)


async def get_research_methods_for_select(
    db: AsyncSession,
    laboratory_id: Optional[int] = None,
    department_id: Optional[int] = None,
) -> list[ResearchMethod]:
    """Получить методы исследования для селекта."""
    return await research_repo.get_research_methods_for_select(
        db, laboratory_id, department_id
    )


def _available_method_brief(method: ResearchMethod) -> AvailableResearchMethodBrief:
    """Собрать краткое описание метода для селекта."""
    return AvailableResearchMethodBrief(
        id=method.id,
        name=method.name,
        sort_order=method.sort_order or 0,
        input_data=method.input_data,
        intermediate_data=method.intermediate_data,
        unit=method.unit,
        equipment_data_default=method.equipment_data_default,
    )


async def get_available_research_methods(
    db: AsyncSession,
    laboratory_id: int,
    department_id: Optional[int] = None,
    sample_id: Optional[int] = None,
) -> AvailableResearchMethodsResponse:
    """Вернуть доступные методы исследования, сгруппированные для селекта."""
    sample = None
    if sample_id:
        sample = await get_sample_by_id(db, sample_id)
        if not sample:
            raise NotFoundError("Проба не найдена")

    methods = await get_research_methods_for_select(
        db, laboratory_id=laboratory_id, department_id=department_id
    )

    if sample_id and sample:
        calculations, _ = await calculation_repo.get_calculations(
            db, sample_id=sample_id, include_deleted=False
        )
        used_method_ids = {calc.research_method_id for calc in calculations}
        methods = [method for method in methods if method.id not in used_method_ids]

        if sample.test_object:
            sample_type = await resolve_tag_by_name(db, sample.test_object)
            if sample_type:
                filtered_methods = []
                for method in methods:
                    if not method.sample_type:
                        continue
                    method_sample_types = (
                        method.sample_type
                        if isinstance(method.sample_type, list)
                        else [method.sample_type]
                    )
                    if sample_type in method_sample_types:
                        filtered_methods.append(method)
                methods = filtered_methods

    all_methods: list[AvailableResearchMethodEntry] = []
    for method in methods:
        if method.groups:
            group = method.groups[0]
            group_entry = next(
                (item for item in all_methods if item.group_id == group.id),
                None,
            )
            if not group_entry:
                group_entry = AvailableResearchMethodEntry(
                    id=f"group_{group.id}",
                    name=group.name,
                    is_group=True,
                    group_id=group.id,
                    methods=[],
                    sort_order=group.sort_order or 0,
                )
                all_methods.append(group_entry)
            group_entry.methods.append(_available_method_brief(method))
        else:
            all_methods.append(
                AvailableResearchMethodEntry(
                    id=method.id,
                    name=method.name,
                    sort_order=method.sort_order or 0,
                    input_data=method.input_data,
                    intermediate_data=method.intermediate_data,
                    unit=method.unit,
                    equipment_data_default=method.equipment_data_default,
                    is_group=False,
                )
            )

    all_methods.sort(key=lambda item: (item.sort_order, item.name))
    for method in all_methods:
        if method.is_group and method.methods:
            method.methods.sort(key=lambda item: (item.sort_order, item.name))

    return AvailableResearchMethodsResponse(methods=all_methods)
