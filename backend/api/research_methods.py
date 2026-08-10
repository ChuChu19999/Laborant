from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from core.deps import DbSession, ScopePaginationParams, UserPermissions
from schemas.pagination import PaginatedResponse
from schemas.research import (
    AvailableResearchMethodsResponse,
    ResearchMethodCreate,
    ResearchMethodResponse,
    ResearchMethodSortOrderUpdate,
    ResearchMethodUpdate,
    SortOrderBatchUpdate,
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
    get_research_method_response_data,
    get_research_methods,
    require_research_method_by_id,
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
    responses={200: {"description": "Список методов исследования успешно получен"}},
)
# @IsAuthenticated
async def list_research_methods(
    db: DbSession,
    effective: UserPermissions,
    params: ScopePaginationParams = Depends(),
    rounding_type: str | None = Query(None),
):
    """Возвращает список методов исследования с пагинацией или без."""
    enforce_research_methods_read(effective, params.laboratory_id, params.department_id)
    methods, total, total_pages = await get_research_methods(
        db,
        laboratory_id=params.laboratory_id,
        department_id=params.department_id,
        page=params.page,
        page_size=params.page_size,
        search=params.search,
        rounding_type=rounding_type,
        sort_by=params.sort_by,
        sort_order=params.sort_order,
    )

    items = [ResearchMethodResponse.model_validate(method) for method in methods]

    return PaginatedResponse(
        items=items,
        total=total,
        page=params.page if params.page is not None else 1,
        page_size=params.page_size if params.page_size is not None else total,
        total_pages=total_pages,
    )


@router.post(
    "/research-methods/",
    response_model=ResearchMethodResponse,
    status_code=201,
    summary="Добавление нового метода исследования",
    description="Добавляет новый метод исследования на основе переданных данных.",
    responses={
        201: {"description": "Метод исследования успешно добавлен"},
        400: {"description": "Некорректные данные для добавления метода исследования"},
    },
)
# @IsAuthenticated
async def create_research_method_endpoint(
    method_data: ResearchMethodCreate,
    db: DbSession,
    effective: UserPermissions,
):
    """Добавляет новый метод исследования на основе переданных данных."""
    enforce_lab_management_access(effective, method_data.laboratory_id, method_data.department_id)
    method = await create_research_method(db, method_data)
    return await get_research_method_response_data(db, method.id)


@router.get(
    "/research-methods/available/",
    response_model=AvailableResearchMethodsResponse,
    summary="Получение доступных методов исследования",
    description=(
        "Возвращает список доступных методов исследования для указанной лаборатории и подразделения. "
        "Методы возвращаются сгруппированными по группам, если они принадлежат группе. "
        "Если указан sample_id, исключаются методы, уже привязанные к этой пробе."
    ),
    responses={200: {"description": "Список доступных методов исследования успешно получен"}},
)
# @IsAuthenticated
async def get_available_research_methods_endpoint(
    db: DbSession,
    effective: UserPermissions,
    laboratory_id: int = Query(..., description="ID лаборатории"),
    department_id: int | None = Query(None, description="ID подразделения"),
    sample_id: int | None = Query(None, description="ID пробы (для исключения уже использованных методов)"),
):
    """Возвращает список доступных методов исследования для указанной лаборатории и подразделения."""
    enforce_nav_access(effective, "samples", laboratory_id, department_id)
    return await get_available_research_methods(
        db,
        laboratory_id=laboratory_id,
        department_id=department_id,
        sample_id=sample_id,
    )


@router.get(
    "/research-methods/{method_id}/",
    response_model=ResearchMethodResponse,
    summary="Получение метода исследования по ID",
    description="Возвращает информацию о методе исследования по его идентификатору.",
    responses={
        200: {"description": "Метод исследования успешно получен"},
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
    """Возвращает информацию о методе исследования по его идентификатору."""
    method = await require_research_method_by_id(db, method_id, include_deleted=include_deleted)
    enforce_research_methods_read(effective, method.laboratory_id, method.department_id)
    return ResearchMethodResponse.model_validate(method)


@router.patch(
    "/research-methods/{method_id}/",
    response_model=ResearchMethodResponse,
    summary="Обновление метода исследования",
    description="Обновляет существующий метод исследования.",
    responses={
        200: {"description": "Метод исследования успешно обновлен"},
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
    """Обновляет существующий метод исследования."""
    method = await require_research_method_by_id(db, method_id)
    lab_id = method_data.laboratory_id or method.laboratory_id
    dept_id = method_data.department_id or method.department_id
    enforce_lab_management_access(effective, lab_id, dept_id)
    await update_research_method(db, method_id, method_data)
    return await get_research_method_response_data(db, method_id)


@router.delete(
    "/research-methods/{method_id}/",
    status_code=204,
    summary="Удаление метода исследования",
    description="Выполняет мягкое удаление метода исследования.",
    responses={
        204: {"description": "Метод исследования успешно удален"},
        404: {"description": "Метод исследования не найден"},
    },
)
# @IsAuthenticated
async def delete_research_method_endpoint(
    method_id: int,
    db: DbSession,
    effective: UserPermissions,
):
    """Выполняет мягкое удаление метода исследования."""
    method = await require_research_method_by_id(db, method_id)
    enforce_lab_management_access(effective, method.laboratory_id, method.department_id)
    await delete_research_method(db, method_id)


@router.patch(
    "/research-methods/{method_id}/sort-order/",
    response_model=ResearchMethodResponse,
    summary="Изменение порядка сортировки метода исследования",
    description="Изменяет порядок сортировки метода исследования.",
    responses={
        200: {"description": "Порядок сортировки успешно изменен"},
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
    """Изменяет порядок сортировки метода исследования."""
    method = await require_research_method_by_id(db, method_id)
    enforce_lab_management_access(effective, method.laboratory_id, method.department_id)
    await update_research_method_sort_order(db, method_id, sort_data)
    return await get_research_method_response_data(db, method_id)


@router.patch(
    "/sort-order/batch/",
    status_code=200,
    summary="Массовое обновление порядка сортировки методов исследования",
    description=("Выполняет массовое обновление порядка сортировки методов и групп исследования."),
    responses={
        200: {"description": "Порядок сортировки успешно обновлен"},
        400: {"description": "Некорректные данные для обновления"},
    },
)
# @IsAuthenticated
async def batch_update_sort_order_endpoint(
    batch_data: SortOrderBatchUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    """Выполняет массовое обновление порядка сортировки методов и групп исследования."""
    enforce_lab_management_access(effective)
    await batch_update_sort_order(db, batch_data)
    return {"message": "Порядок сортировки успешно обновлен"}
