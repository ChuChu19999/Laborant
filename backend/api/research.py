from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, Query
from core.auth_decorators import IsAuthenticated
from core.deps import DbSession, ScopePaginationParams
from core.exceptions import NotFoundError
from schemas.pagination import PaginatedResponse
from schemas.research import (
    AvailableResearchMethodsResponse,
    ResearchMethodCreate,
    ResearchMethodGroupCreate,
    ResearchMethodGroupResponse,
    ResearchMethodGroupUpdate,
    ResearchMethodResponse,
    ResearchMethodSortOrderUpdate,
    ResearchMethodUpdate,
    SortOrderBatchUpdate,
)
from services.research import (
    batch_update_sort_order,
    build_research_method_group_response,
    create_research_method,
    create_research_method_group,
    delete_research_method,
    delete_research_method_group,
    get_available_research_methods,
    get_research_method_by_id,
    get_research_method_group_by_id,
    get_research_method_groups,
    get_research_method_response_data,
    get_research_methods,
    update_research_method,
    update_research_method_group,
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
    params: ScopePaginationParams = Depends(),
    rounding_type: Optional[str] = Query(None),
):
    """Возвращает список методов исследования с пагинацией или без."""
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
):
    """Добавляет новый метод исследования на основе переданных данных."""
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
    responses={
        200: {"description": "Список доступных методов исследования успешно получен"}
    },
)
# @IsAuthenticated
async def get_available_research_methods_endpoint(
    db: DbSession,
    laboratory_id: int = Query(..., description="ID лаборатории"),
    department_id: Optional[int] = Query(None, description="ID подразделения"),
    sample_id: Optional[int] = Query(
        None, description="ID пробы (для исключения уже использованных методов)"
    ),
):
    """Возвращает список доступных методов исследования для указанной лаборатории и подразделения."""
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
    include_deleted: bool = Query(False),
):
    """Возвращает информацию о методе исследования по его идентификатору."""
    method = await get_research_method_by_id(
        db, method_id, include_deleted=include_deleted
    )
    if not method:
        raise NotFoundError("Метод исследования не найден")
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
):
    """Обновляет существующий метод исследования."""
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
):
    """Выполняет мягкое удаление метода исследования."""
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
):
    """Изменяет порядок сортировки метода исследования."""
    await update_research_method_sort_order(db, method_id, sort_data)
    return await get_research_method_response_data(db, method_id)


@router.patch(
    "/sort-order/batch/",
    status_code=200,
    summary="Массовое обновление порядка сортировки методов исследования",
    description=(
        "Выполняет массовое обновление порядка сортировки методов и групп исследования."
    ),
    responses={
        200: {"description": "Порядок сортировки успешно обновлен"},
        400: {"description": "Некорректные данные для обновления"},
    },
)
# @IsAuthenticated
async def batch_update_sort_order_endpoint(
    batch_data: SortOrderBatchUpdate,
    db: DbSession,
):
    """Выполняет массовое обновление порядка сортировки методов и групп исследования."""
    await batch_update_sort_order(db, batch_data)
    return {"message": "Порядок сортировки успешно обновлен"}


@router.get(
    "/research-method-groups/",
    response_model=PaginatedResponse[ResearchMethodGroupResponse],
    summary="Получение списка групп методов исследования",
    description=(
        "Возвращает список групп методов исследования с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает поиск и сортировку."
    ),
    responses={
        200: {"description": "Список групп методов исследования успешно получен"}
    },
)
# @IsAuthenticated
async def list_research_method_groups(
    db: DbSession,
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
):
    """Возвращает список групп методов исследования с пагинацией или без."""
    groups, total, total_pages = await get_research_method_groups(
        db,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return PaginatedResponse(
        items=[build_research_method_group_response(group) for group in groups],
        total=total,
        page=page if page is not None else 1,
        page_size=page_size if page_size is not None else total,
        total_pages=total_pages,
    )


@router.post(
    "/research-method-groups/",
    response_model=ResearchMethodGroupResponse,
    status_code=201,
    summary="Добавление новой группы методов исследования",
    description="Добавляет новую группу методов исследования на основе переданных данных.",
    responses={
        201: {"description": "Группа методов исследования успешно добавлена"},
        400: {
            "description": "Некорректные данные для добавления группы методов исследования"
        },
    },
)
# @IsAuthenticated
async def create_research_method_group_endpoint(
    group_data: ResearchMethodGroupCreate,
    db: DbSession,
):
    """Добавляет новую группу методов исследования на основе переданных данных."""
    group = await create_research_method_group(db, group_data)
    return build_research_method_group_response(group)


@router.get(
    "/research-method-groups/{group_id}/",
    response_model=ResearchMethodGroupResponse,
    summary="Получение группы методов исследования по ID",
    description="Возвращает информацию о группе методов исследования по ее идентификатору.",
    responses={
        200: {"description": "Группа методов исследования успешно получена"},
        404: {"description": "Группа методов исследования не найдена"},
    },
)
# @IsAuthenticated
async def get_research_method_group(
    group_id: int,
    db: DbSession,
    include_deleted: bool = Query(
        False,
        description="Включить скрытые группы (для сохранения связи при редактировании методики)",
    ),
):
    """Возвращает информацию о группе методов исследования по ее идентификатору."""
    group = await get_research_method_group_by_id(
        db, group_id, include_deleted=include_deleted
    )
    if not group:
        raise NotFoundError("Группа методов исследования не найдена")
    return build_research_method_group_response(group)


@router.patch(
    "/research-method-groups/{group_id}/",
    response_model=ResearchMethodGroupResponse,
    summary="Обновление группы методов исследования",
    description="Обновляет существующую группу методов исследования.",
    responses={
        200: {"description": "Группа методов исследования успешно обновлена"},
        404: {"description": "Группа методов исследования не найдена"},
    },
)
# @IsAuthenticated
async def update_research_method_group_endpoint(
    group_id: int,
    group_data: ResearchMethodGroupUpdate,
    db: DbSession,
):
    """Обновляет существующую группу методов исследования."""
    group = await update_research_method_group(db, group_id, group_data)
    return build_research_method_group_response(group)


@router.delete(
    "/research-method-groups/{group_id}/",
    status_code=204,
    summary="Удаление группы методов исследования",
    description="Выполняет мягкое удаление группы методов исследования вместе с ее методами.",
    responses={
        204: {"description": "Группа методов исследования успешно удалена"},
        404: {"description": "Группа методов исследования не найдена"},
    },
)
# @IsAuthenticated
async def delete_research_method_group_endpoint(
    group_id: int,
    db: DbSession,
):
    """Выполняет мягкое удаление группы методов исследования вместе с ее методами."""
    await delete_research_method_group(db, group_id)
