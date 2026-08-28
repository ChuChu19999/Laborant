from __future__ import annotations
from fastapi import APIRouter, Query
from core.deps import CalculationListFiltersDep, DbSession, UserPermissions
from schemas.calculation import (
    CalculateRequest,
    CalculateResponse,
    CalculationCreate,
    CalculationResponse,
    CalculationUpdate,
    MethodologyChoiceResponse,
)
from schemas.pagination import PaginatedResponse, build_paginated_response
from services.access_control import enforce_crud_access, resolve_calculations_read_access
from services.calculation.service import (
    create_calculation_for_response,
    delete_calculation,
    execute_calculation_with_access,
    get_calculation_for_response,
    get_calculation_methodology_choice,
    get_calculations,
    get_calculations_by_sample,
    replace_calculation_for_response,
    require_calculation_by_id,
    resolve_calculation_replace_scope,
    resolve_calculation_update_scope,
    update_calculation_for_response,
)
from services.sample.service import require_sample_by_id

router = APIRouter()


@router.get(
    "/calculations/",
    response_model=PaginatedResponse[CalculationResponse],
    summary="Получение списка расчётов",
    description=(
        "Возвращает список расчётов с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по пробам, лабораториям, подразделениям и методам исследования. "
        "Можно указать несколько ID проб через запятую в параметре sample_ids."
    ),
    responses={
        200: {"description": "Список расчётов успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def list_calculations(
    db: DbSession,
    effective: UserPermissions,
    filters: CalculationListFiltersDep,
):
    enforce_crud_access(
        effective,
        "calculations",
        "execute",
        filters.laboratory_id,
        filters.department_id,
    )
    calculations, total = await get_calculations(
        db,
        sample_id=filters.sample_id,
        sample_ids=filters.sample_ids,
        laboratory_id=filters.laboratory_id,
        department_id=filters.department_id,
        research_method_id=filters.research_method_id,
        include_deleted=filters.include_deleted,
        page=filters.page,
        page_size=filters.page_size,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
    )
    return build_paginated_response(calculations, total, filters.page, filters.page_size)


@router.get(
    "/calculations/by-sample/{sample_id:int}/",
    response_model=list[CalculationResponse],
    summary="Получение расчётов по пробе",
    description="Возвращает все расчёты для указанной пробы без пагинации.",
    responses={
        200: {"description": "Список расчётов успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def get_calculations_by_sample_endpoint(
    sample_id: int,
    db: DbSession,
    effective: UserPermissions,
    include_deleted: bool = Query(False),
    sort_by: str | None = Query(None),
    sort_order: str | None = Query("desc"),
) -> list[CalculationResponse]:
    sample = await require_sample_by_id(db, sample_id)
    resolve_calculations_read_access(effective, sample.laboratory_id, sample.department_id)
    return await get_calculations_by_sample(
        db,
        sample_id=sample_id,
        include_deleted=include_deleted,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.post(
    "/calculations/",
    response_model=CalculationResponse,
    status_code=201,
    summary="Добавление нового расчёта",
    description=(
        "Добавляет новый расчёт на основе переданных данных. Расчёт привязывается к пробе и методу исследования."
    ),
    responses={
        201: {"description": "Расчёт успешно добавлен"},
        400: {"description": "Некорректные данные для добавления расчёта"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def create_calculation_endpoint(
    calculation_data: CalculationCreate,
    db: DbSession,
    effective: UserPermissions,
) -> CalculationResponse:
    enforce_crud_access(
        effective,
        "calculations",
        "create",
        calculation_data.laboratory_id,
        calculation_data.department_id,
    )
    return await create_calculation_for_response(db, calculation_data)


@router.get(
    "/calculations/{calculation_id:int}/methodology-choice/",
    response_model=MethodologyChoiceResponse,
    summary="Проверка версии методики при редактировании расчёта",
    description=(
        "Возвращает статус изменения методики с момента сохранения расчёта и идентификаторы старой и актуальной версий."
    ),
    responses={
        200: {"description": "Статус методики успешно получен"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Расчёт или метод не найден"},
    },
)
# @IsAuthenticated
async def get_calculation_methodology_choice_endpoint(
    calculation_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> MethodologyChoiceResponse:
    calculation = await require_calculation_by_id(db, calculation_id)
    enforce_crud_access(
        effective,
        "calculations",
        "execute",
        calculation.laboratory_id,
        calculation.department_id,
    )
    return await get_calculation_methodology_choice(db, calculation)


@router.get(
    "/calculations/{calculation_id:int}/",
    response_model=CalculationResponse,
    summary="Получение расчёта по ID",
    description="Возвращает информацию о расчёте по его идентификатору.",
    responses={
        200: {"description": "Расчёт успешно получен"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Расчёт не найден"},
    },
)
# @IsAuthenticated
async def get_calculation(
    calculation_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> CalculationResponse:
    calculation = await require_calculation_by_id(db, calculation_id)
    enforce_crud_access(
        effective,
        "calculations",
        "execute",
        calculation.laboratory_id,
        calculation.department_id,
    )
    return await get_calculation_for_response(db, calculation)


@router.patch(
    "/calculations/{calculation_id:int}/",
    response_model=CalculationResponse,
    summary="Обновление расчёта",
    description=("Обновляет существующий расчёт."),
    responses={
        200: {"description": "Расчёт успешно обновлен"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Расчёт не найден"},
    },
)
# @IsAuthenticated
async def update_calculation_endpoint(
    calculation_id: int,
    calculation_data: CalculationUpdate,
    db: DbSession,
    effective: UserPermissions,
) -> CalculationResponse:
    existing = await require_calculation_by_id(db, calculation_id)
    lab_id, dept_id = resolve_calculation_update_scope(existing, calculation_data)
    enforce_crud_access(effective, "calculations", "update", lab_id, dept_id)
    return await update_calculation_for_response(db, calculation_id, calculation_data, calculation=existing)


@router.delete(
    "/calculations/{calculation_id:int}/",
    status_code=204,
    summary="Удаление расчёта",
    description=("Выполняет мягкое удаление расчёта."),
    responses={
        204: {"description": "Расчёт успешно удалён"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Расчёт не найден"},
    },
)
# @IsAuthenticated
async def delete_calculation_endpoint(
    calculation_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    calculation = await require_calculation_by_id(db, calculation_id)
    enforce_crud_access(
        effective,
        "calculations",
        "delete",
        calculation.laboratory_id,
        calculation.department_id,
    )
    await delete_calculation(db, calculation)


@router.post(
    "/calculations/{calculation_id:int}/replace/",
    response_model=CalculationResponse,
    status_code=201,
    summary="Замена расчёта новой версией",
    description=(
        "Выполняет замену расчёта: помечает текущую запись как удалённую "
        "и создаёт новую для той же пробы и метода исследования."
    ),
    responses={
        201: {"description": "Расчёт успешно заменён"},
        400: {"description": "Некорректные данные или попытка сменить пробу или метод"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Расчёт не найден"},
    },
)
async def replace_calculation_endpoint(
    calculation_id: int,
    calculation_data: CalculationCreate,
    db: DbSession,
    effective: UserPermissions,
) -> CalculationResponse:
    existing = await require_calculation_by_id(db, calculation_id)
    lab_id, dept_id = resolve_calculation_replace_scope(existing, calculation_data)
    enforce_crud_access(effective, "calculations", "create", lab_id, dept_id)
    return await replace_calculation_for_response(
        db,
        calculation_id,
        calculation_data,
        calculation=existing,
    )


@router.post(
    "/calculate/",
    response_model=CalculateResponse,
    summary="Выполнение расчёта",
    description=(
        "Выполняет расчёт результата на основе входных данных и метода исследования. "
        "Возвращает результат расчёта с промежуточными результатами, условиями повторяемости и погрешностью."
    ),
    responses={
        200: {"description": "Расчёт успешно выполнен"},
        400: {"description": "Некорректные входные данные"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Метод исследования не найден"},
    },
)
# @IsAuthenticated
async def calculate_endpoint(
    request: CalculateRequest,
    db: DbSession,
    effective: UserPermissions,
) -> CalculateResponse:
    return await execute_calculation_with_access(db, effective, request)
