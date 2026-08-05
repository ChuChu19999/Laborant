from __future__ import annotations
from fastapi import APIRouter, Depends
from core.auth_decorators import IsAuthenticated
from core.deps import DbSession, ScopeSortPaginationParams, UserPermissions
from schemas.pagination import PaginatedResponse
from schemas.sample import (
    SelectionConditionsCreate,
    SelectionConditionsResponse,
    SelectionConditionsUpdate,
)
from services.access_control import enforce_lab_management_access
from services.sample import (
    build_selection_conditions_response,
    create_selection_conditions,
    delete_selection_conditions,
    get_selection_conditions,
    get_selection_conditions_response_data,
    require_selection_conditions_by_id,
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
    responses={200: {"description": "Список условий отбора успешно получен"}},
)
# @IsAuthenticated
async def list_selection_conditions(
    db: DbSession,
    effective: UserPermissions,
    params: ScopeSortPaginationParams = Depends(),
):
    """Возвращает список условий отбора с пагинацией или без."""
    enforce_lab_management_access(effective, params.laboratory_id, params.department_id)
    conditions, total, total_pages = await get_selection_conditions(
        db,
        laboratory_id=params.laboratory_id,
        department_id=params.department_id,
        page=params.page,
        page_size=params.page_size,
        sort_by=params.sort_by,
        sort_order=params.sort_order,
    )

    items = [build_selection_conditions_response(condition) for condition in conditions]

    return PaginatedResponse(
        items=items,
        total=total,
        page=params.page if params.page is not None else 1,
        page_size=params.page_size if params.page_size is not None else total,
        total_pages=total_pages,
    )


@router.post(
    "/selection-conditions/",
    response_model=SelectionConditionsResponse,
    status_code=201,
    summary="Добавление условий отбора",
    description="Добавляет новые условия отбора на основе переданных данных.",
    responses={
        201: {"description": "Условия отбора успешно добавлены"},
        400: {"description": "Некорректные данные для добавления условий отбора"},
    },
)
# @IsAuthenticated
async def create_selection_conditions_endpoint(
    conditions_data: SelectionConditionsCreate,
    db: DbSession,
    effective: UserPermissions,
):
    """Добавляет новые условия отбора на основе переданных данных."""
    enforce_lab_management_access(
        effective, conditions_data.laboratory_id, conditions_data.department_id
    )
    conditions = await create_selection_conditions(db, conditions_data)
    return await get_selection_conditions_response_data(db, conditions.id)


@router.patch(
    "/selection-conditions/{conditions_id}/",
    response_model=SelectionConditionsResponse,
    summary="Обновление условий отбора",
    description="Обновляет существующие условия отбора.",
    responses={
        200: {"description": "Условия отбора успешно обновлены"},
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
    """Обновляет существующие условия отбора."""
    conditions = await require_selection_conditions_by_id(db, conditions_id)
    lab_id = conditions_data.laboratory_id or conditions.laboratory_id
    dept_id = conditions_data.department_id or conditions.department_id
    enforce_lab_management_access(effective, lab_id, dept_id)
    await update_selection_conditions(db, conditions_id, conditions_data)
    return await get_selection_conditions_response_data(db, conditions_id)


@router.delete(
    "/selection-conditions/{conditions_id}/",
    status_code=204,
    summary="Удаление условий отбора",
    description="Выполняет мягкое удаление условий отбора.",
    responses={
        204: {"description": "Условия отбора успешно удалены"},
        404: {"description": "Условия отбора не найдены"},
    },
)
# @IsAuthenticated
async def delete_selection_conditions_endpoint(
    conditions_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Выполняет мягкое удаление условий отбора."""
    conditions = await require_selection_conditions_by_id(db, conditions_id)
    enforce_lab_management_access(
        effective, conditions.laboratory_id, conditions.department_id
    )
    await delete_selection_conditions(db, conditions_id)
