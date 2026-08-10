from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from core.deps import DbSession, ScopeSortPaginationParams, UserPermissions
from core.exceptions import ForbiddenError, ValidationError
from schemas.calculation import (
    CalculateRequest,
    CalculationCreate,
    CalculationResponse,
    CalculationUpdate,
    MethodologyChoiceResponse,
)
from schemas.pagination import PaginatedResponse
from services.access_control import enforce_crud_access, enforce_nav_access
from services.calculation import (
    create_calculation,
    delete_calculation,
    execute_calculation,
    get_calculation_methodology_choice,
    get_calculation_response_data,
    get_calculations,
    get_calculations_by_sample,
    get_calculations_response_data,
    replace_calculation,
    require_calculation_by_id,
    update_calculation,
)
from services.research import require_research_method_by_id
from services.sample import require_sample_by_id

router = APIRouter()


@router.get(
    "/calculations/",
    response_model=PaginatedResponse[CalculationResponse],
    summary="Получение списка расчетов",
    description=(
        "Возвращает список расчетов с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по пробам, лабораториям, подразделениям и методам исследования. "
        "Можно указать несколько ID проб через запятую в параметре sample_ids."
    ),
    responses={
        200: {"description": "Список расчетов успешно получен"},
    },
)
# @IsAuthenticated
async def list_calculations(
    db: DbSession,
    effective: UserPermissions,
    params: ScopeSortPaginationParams = Depends(),
    sample_id: int | None = Query(None),
    sample_ids: str | None = Query(None, description="Список ID проб через запятую"),
    research_method_id: int | None = Query(None),
    include_deleted: bool = Query(False),
):
    """Возвращает список расчетов с пагинацией или без."""
    enforce_crud_access(
        effective,
        "calculations",
        "execute",
        params.laboratory_id,
        params.department_id,
    )
    sample_ids_list = None
    if sample_ids:
        try:
            sample_ids_list = [int(id.strip()) for id in sample_ids.split(",") if id.strip()]
        except ValueError as exc:
            raise ValidationError("Некорректный формат sample_ids: ожидаются целые числа через запятую") from exc

    calculations, total, total_pages = await get_calculations(
        db,
        sample_id=sample_id,
        sample_ids=sample_ids_list,
        laboratory_id=params.laboratory_id,
        department_id=params.department_id,
        research_method_id=research_method_id,
        include_deleted=include_deleted,
        page=params.page,
        page_size=params.page_size,
        sort_by=params.sort_by,
        sort_order=params.sort_order,
    )

    items = await get_calculations_response_data(db, calculations)

    return PaginatedResponse(
        items=items,
        total=total,
        page=params.page if params.page is not None else 1,
        page_size=params.page_size if params.page_size is not None else total,
        total_pages=total_pages,
    )


@router.get(
    "/calculations/by-sample/{sample_id}/",
    response_model=list[CalculationResponse],
    summary="Получение расчетов по пробе",
    description="Возвращает все расчеты для указанной пробы без пагинации.",
    responses={
        200: {"description": "Список расчетов успешно получен"},
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
):
    """Возвращает все расчеты для указанной пробы без пагинации."""
    sample = await require_sample_by_id(db, sample_id)
    try:
        enforce_nav_access(effective, "samples", sample.laboratory_id, sample.department_id)
    except ForbiddenError:
        enforce_crud_access(
            effective,
            "calculations",
            "execute",
            sample.laboratory_id,
            sample.department_id,
        )
    calculations = await get_calculations_by_sample(
        db,
        sample_id=sample_id,
        include_deleted=include_deleted,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return await get_calculations_response_data(db, calculations)


@router.post(
    "/calculations/",
    response_model=CalculationResponse,
    status_code=201,
    summary="Добавление нового расчета",
    description=(
        "Добавляет новый расчет на основе переданных данных. Расчет привязывается к пробе и методу исследования."
    ),
    responses={
        201: {"description": "Расчет успешно добавлен"},
        400: {"description": "Некорректные данные для добавления расчета"},
    },
)
# @IsAuthenticated
async def create_calculation_endpoint(
    calculation_data: CalculationCreate,
    db: DbSession,
    effective: UserPermissions,
):
    """Добавляет новый расчет на основе переданных данных."""
    enforce_crud_access(
        effective,
        "calculations",
        "create",
        calculation_data.laboratory_id,
        calculation_data.department_id,
    )
    calculation = await create_calculation(db, calculation_data)
    return await get_calculation_response_data(db, calculation.id)


@router.get(
    "/calculations/{calculation_id}/methodology-choice/",
    response_model=MethodologyChoiceResponse,
    summary="Проверка версии методики при редактировании расчета",
    description=(
        "Возвращает статус изменения методики с момента сохранения расчета и идентификаторы старой и актуальной версий."
    ),
    responses={
        200: {"description": "Статус методики успешно получен"},
        404: {"description": "Расчет или метод не найден"},
    },
)
# @IsAuthenticated
async def get_calculation_methodology_choice_endpoint(
    calculation_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Возвращает статус изменения методики при редактировании расчета."""
    calculation = await require_calculation_by_id(db, calculation_id)
    enforce_crud_access(
        effective,
        "calculations",
        "execute",
        calculation.laboratory_id,
        calculation.department_id,
    )
    return await get_calculation_methodology_choice(db, calculation_id)


@router.get(
    "/calculations/{calculation_id}/",
    response_model=CalculationResponse,
    summary="Получение расчета по ID",
    description="Возвращает информацию о расчете по его идентификатору.",
    responses={
        200: {"description": "Расчет успешно получен"},
        404: {"description": "Расчет не найден"},
    },
)
# @IsAuthenticated
async def get_calculation(
    calculation_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Возвращает информацию о расчете по его идентификатору."""
    calculation = await require_calculation_by_id(db, calculation_id)
    enforce_crud_access(
        effective,
        "calculations",
        "execute",
        calculation.laboratory_id,
        calculation.department_id,
    )
    return await get_calculation_response_data(db, calculation_id)


@router.patch(
    "/calculations/{calculation_id}/",
    response_model=CalculationResponse,
    summary="Обновление расчета",
    description=("Обновляет существующий расчет."),
    responses={
        200: {"description": "Расчет успешно обновлен"},
        404: {"description": "Расчет не найден"},
    },
)
# @IsAuthenticated
async def update_calculation_endpoint(
    calculation_id: int,
    calculation_data: CalculationUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    """Обновляет существующий расчет."""
    existing = await require_calculation_by_id(db, calculation_id)
    lab_id = calculation_data.laboratory_id or existing.laboratory_id
    dept_id = calculation_data.department_id or existing.department_id
    enforce_crud_access(effective, "calculations", "update", lab_id, dept_id)
    calculation = await update_calculation(db, calculation_id, calculation_data)
    return await get_calculation_response_data(db, calculation.id)


@router.delete(
    "/calculations/{calculation_id}/",
    status_code=204,
    summary="Удаление расчета",
    description=("Выполняет мягкое удаление расчета."),
    responses={
        204: {"description": "Расчет успешно удален"},
        404: {"description": "Расчет не найден"},
    },
)
# @IsAuthenticated
async def delete_calculation_endpoint(
    calculation_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Выполняет мягкое удаление расчета."""
    calculation = await require_calculation_by_id(db, calculation_id)
    enforce_crud_access(
        effective,
        "calculations",
        "delete",
        calculation.laboratory_id,
        calculation.department_id,
    )
    await delete_calculation(db, calculation_id)


@router.post(
    "/calculations/{calculation_id}/replace/",
    response_model=CalculationResponse,
    status_code=201,
    summary="Замена расчета новой версией",
    description=(
        "Выполняет замену расчета: помечает текущую запись как удаленную "
        "и создает новую для той же пробы и метода исследования."
    ),
    responses={
        201: {"description": "Расчет успешно заменен"},
        400: {"description": "Некорректные данные или попытка сменить пробу или метод"},
        404: {"description": "Расчет не найден"},
    },
)
async def replace_calculation_endpoint(
    calculation_id: int,
    calculation_data: CalculationCreate,
    db: DbSession,
    effective: UserPermissions,
):
    """Выполняет замену расчета: помечает текущую запись как удаленную и создает новую."""
    existing = await require_calculation_by_id(db, calculation_id)
    lab_id = calculation_data.laboratory_id or existing.laboratory_id
    dept_id = calculation_data.department_id or existing.department_id
    enforce_crud_access(effective, "calculations", "create", lab_id, dept_id)
    calculation = await replace_calculation(db, calculation_id, calculation_data)
    return await get_calculation_response_data(db, calculation.id)


@router.post(
    "/calculate/",
    summary="Выполнение расчета",
    description=(
        "Выполняет расчет результата на основе входных данных и метода исследования. "
        "Возвращает результат расчета с промежуточными результатами, условиями повторяемости и погрешностью."
    ),
    responses={
        200: {"description": "Расчет успешно выполнен"},
        400: {"description": "Некорректные входные данные"},
        404: {"description": "Метод исследования не найден"},
    },
)
# @IsAuthenticated
async def calculate_endpoint(
    request: CalculateRequest,
    db: DbSession,
    effective: UserPermissions,
):
    """Выполняет расчет результата на основе входных данных и метода исследования."""
    method = await require_research_method_by_id(db, request.research_method_id)
    enforce_crud_access(
        effective,
        "calculations",
        "execute",
        method.laboratory_id,
        method.department_id,
    )
    return await execute_calculation(db, request)
