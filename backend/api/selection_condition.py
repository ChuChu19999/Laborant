from __future__ import annotations
from fastapi import APIRouter
from core.deps import DbSession, ScopeSortPaginationDep, UserPermissions
from schemas.pagination import PaginatedResponse, build_paginated_response
from schemas.selection_conditions import (
    SelectionConditionsCreate,
    SelectionConditionsResponse,
    SelectionConditionsUpdate,
)
from services.access_control import (
    enforce_lab_management_access,
    enforce_selection_conditions_read,
)
from services.selection_condition import (
    create_selection_conditions,
    delete_selection_conditions,
    get_selection_conditions,
    require_selection_conditions_by_id,
    resolve_selection_conditions_update_scope,
    update_selection_conditions,
)

router = APIRouter()


@router.get(
    "/selection-conditions/",
    response_model=PaginatedResponse[SelectionConditionsResponse],
    summary="Получение списка условий отбора",
    description=(
        "Возвращает список условий отбора с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по лабораториям и подразделениям, сортировку."
    ),
    responses={
        200: {"description": "Список условий отбора успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def list_selection_conditions(
    db: DbSession,
    effective: UserPermissions,
    params: ScopeSortPaginationDep,
):
    enforce_selection_conditions_read(effective, params.laboratory_id, params.department_id)
    conditions, total = await get_selection_conditions(
        db,
        laboratory_id=params.laboratory_id,
        department_id=params.department_id,
        page=params.page,
        page_size=params.page_size,
        sort_by=params.sort_by,
        sort_order=params.sort_order,
    )
    return build_paginated_response(conditions, total, params.page, params.page_size)


@router.post(
    "/selection-conditions/",
    response_model=SelectionConditionsResponse,
    status_code=201,
    summary="Добавление условий отбора",
    description="Добавляет новые условия отбора на основе переданных данных.",
    responses={
        201: {"description": "Условия отбора успешно добавлены"},
        400: {"description": "Некорректные данные для добавления условий отбора"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def create_selection_conditions_endpoint(
    conditions_data: SelectionConditionsCreate,
    db: DbSession,
    effective: UserPermissions,
):
    enforce_lab_management_access(effective, conditions_data.laboratory_id, conditions_data.department_id)
    return await create_selection_conditions(db, conditions_data)


@router.patch(
    "/selection-conditions/{conditions_id:int}/",
    response_model=SelectionConditionsResponse,
    summary="Обновление условий отбора",
    description="Обновляет существующие условия отбора.",
    responses={
        200: {"description": "Условия отбора успешно обновлены"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Условия отбора не найдены"},
    },
)
# @IsAuthenticated
async def update_selection_conditions_endpoint(
    conditions_id: int,
    conditions_data: SelectionConditionsUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    conditions = await require_selection_conditions_by_id(db, conditions_id)
    lab_id, dept_id = resolve_selection_conditions_update_scope(conditions, conditions_data)
    enforce_lab_management_access(effective, lab_id, dept_id)
    return await update_selection_conditions(db, conditions, conditions_data)


@router.delete(
    "/selection-conditions/{conditions_id:int}/",
    status_code=204,
    summary="Удаление условий отбора",
    description="Выполняет мягкое удаление условий отбора.",
    responses={
        204: {"description": "Условия отбора успешно удалены"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Условия отбора не найдены"},
    },
)
# @IsAuthenticated
async def delete_selection_conditions_endpoint(
    conditions_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    conditions = await require_selection_conditions_by_id(db, conditions_id)
    enforce_lab_management_access(effective, conditions.laboratory_id, conditions.department_id)
    await delete_selection_conditions(db, conditions)
