from __future__ import annotations
from fastapi import APIRouter, Query
from core.deps import DbSession, ResearchMethodListFiltersDep, UserPermissions
from schemas.pagination import PaginatedResponse, build_paginated_response
from schemas.research import (
    AvailableResearchMethodsResponse,
    ResearchMethodCreate,
    ResearchMethodResponse,
    ResearchMethodSortOrderUpdate,
    ResearchMethodUpdate,
    SortOrderBatchUpdate,
    SortOrderBatchUpdateResponse,
)
from services.access_control import (
    enforce_lab_management_access,
    enforce_nav_access,
    enforce_research_methods_read,
)
from services.research import (
    batch_update_sort_order,
    create_research_method,
    delete_research_method,
    get_available_research_methods,
    get_research_methods,
    require_research_method_by_id,
    resolve_research_method_update_scope,
    update_research_method,
    update_research_method_sort_order,
)

router = APIRouter()


@router.get(
    "/research-methods/",
    response_model=PaginatedResponse[ResearchMethodResponse],
    summary="Получение списка методов исследования",
    description=(
        "Возвращает список методов исследования с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает фильтрацию по лабораториям, подразделениям и типу округления, поиск и сортировку."
    ),
    responses={
        200: {"description": "Список методов исследования успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def list_research_methods(
    db: DbSession,
    effective: UserPermissions,
    filters: ResearchMethodListFiltersDep,
):
    enforce_research_methods_read(effective, filters.laboratory_id, filters.department_id)
    methods, total = await get_research_methods(
        db,
        laboratory_id=filters.laboratory_id,
        department_id=filters.department_id,
        page=filters.page,
        page_size=filters.page_size,
        search=filters.search,
        rounding_type=filters.rounding_type,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
    )
    return build_paginated_response(methods, total, filters.page, filters.page_size)


@router.post(
    "/research-methods/",
    response_model=ResearchMethodResponse,
    status_code=201,
    summary="Добавление нового метода исследования",
    description="Добавляет новый метод исследования на основе переданных данных.",
    responses={
        201: {"description": "Метод исследования успешно добавлен"},
        400: {"description": "Некорректные данные для добавления метода исследования"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def create_research_method_endpoint(
    method_data: ResearchMethodCreate,
    db: DbSession,
    effective: UserPermissions,
):
    enforce_lab_management_access(effective, method_data.laboratory_id, method_data.department_id)
    return await create_research_method(db, method_data)


@router.get(
    "/research-methods/available/",
    response_model=AvailableResearchMethodsResponse,
    summary="Получение доступных методов исследования",
    description=(
        "Возвращает список доступных методов исследования для указанной лаборатории и подразделения. "
        "Методы возвращаются сгруппированными по группам, если они принадлежат группе. "
        "Если указан sample_id, исключаются методы, уже привязанные к этой пробе."
    ),
    responses={
        200: {"description": "Список доступных методов исследования успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def get_available_research_methods_endpoint(
    db: DbSession,
    effective: UserPermissions,
    laboratory_id: int = Query(..., description="ID лаборатории"),
    department_id: int | None = Query(None, description="ID подразделения"),
    sample_id: int | None = Query(None, description="ID пробы (для исключения уже использованных методов)"),
) -> AvailableResearchMethodsResponse:
    enforce_nav_access(effective, "samples", laboratory_id, department_id)
    return await get_available_research_methods(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        sample_id=sample_id,
    )


@router.get(
    "/research-methods/{method_id:int}/",
    response_model=ResearchMethodResponse,
    summary="Получение метода исследования по ID",
    description="Возвращает информацию о методе исследования по его идентификатору.",
    responses={
        200: {"description": "Метод исследования успешно получен"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Метод исследования не найден"},
    },
)
# @IsAuthenticated
async def get_research_method(
    method_id: int,
    db: DbSession,
    effective: UserPermissions,
    include_deleted: bool = Query(False),
):
    method = await require_research_method_by_id(db, method_id, include_deleted=include_deleted)
    enforce_research_methods_read(
        effective,
        method.laboratory_id,
        method.department_id,
    )
    return method


@router.patch(
    "/research-methods/{method_id:int}/",
    response_model=ResearchMethodResponse,
    summary="Обновление метода исследования",
    description="Обновляет существующий метод исследования.",
    responses={
        200: {"description": "Метод исследования успешно обновлен"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Метод исследования не найден"},
    },
)
# @IsAuthenticated
async def update_research_method_endpoint(
    method_id: int,
    method_data: ResearchMethodUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    method = await require_research_method_by_id(db, method_id)
    lab_id, dept_id = resolve_research_method_update_scope(method, method_data)
    enforce_lab_management_access(effective, lab_id, dept_id)
    return await update_research_method(db, method, method_data)


@router.delete(
    "/research-methods/{method_id:int}/",
    status_code=204,
    summary="Удаление метода исследования",
    description="Выполняет мягкое удаление метода исследования.",
    responses={
        204: {"description": "Метод исследования успешно удалён"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Метод исследования не найден"},
    },
)
# @IsAuthenticated
async def delete_research_method_endpoint(
    method_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    method = await require_research_method_by_id(db, method_id)
    enforce_lab_management_access(effective, method.laboratory_id, method.department_id)
    await delete_research_method(db, method)


@router.patch(
    "/research-methods/{method_id:int}/sort-order/",
    response_model=ResearchMethodResponse,
    summary="Изменение порядка сортировки метода исследования",
    description="Изменяет порядок сортировки метода исследования.",
    responses={
        200: {"description": "Порядок сортировки успешно изменён"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Метод исследования не найден"},
    },
)
# @IsAuthenticated
async def update_research_method_sort_order_endpoint(
    method_id: int,
    sort_data: ResearchMethodSortOrderUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    method = await require_research_method_by_id(db, method_id)
    enforce_lab_management_access(effective, method.laboratory_id, method.department_id)
    return await update_research_method_sort_order(db, method, sort_data)


@router.patch(
    "/research-methods/sort-order/batch/",
    response_model=SortOrderBatchUpdateResponse,
    status_code=200,
    summary="Массовое обновление порядка сортировки методов исследования",
    description=("Выполняет массовое обновление порядка сортировки методов и групп исследования."),
    responses={
        200: {"description": "Порядок сортировки успешно обновлен"},
        400: {"description": "Некорректные данные для обновления"},
        403: {"description": "Отказано в доступе"},
    },
)
@router.patch(
    "/sort-order/batch/",
    response_model=SortOrderBatchUpdateResponse,
    status_code=200,
    summary="Массовое обновление порядка сортировки методов исследования",
    description=("Выполняет массовое обновление порядка сортировки методов и групп исследования."),
    responses={
        200: {"description": "Порядок сортировки успешно обновлен"},
        400: {"description": "Некорректные данные для обновления"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def batch_update_sort_order_endpoint(
    batch_data: SortOrderBatchUpdate,
    db: DbSession,
    effective: UserPermissions,
) -> SortOrderBatchUpdateResponse:
    enforce_lab_management_access(effective)
    return await batch_update_sort_order(db, batch_data)
