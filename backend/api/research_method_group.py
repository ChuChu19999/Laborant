from __future__ import annotations
from fastapi import APIRouter, Query
from core.deps import DbSession, PaginationSearchSortDep, UserPermissions
from schemas.pagination import PaginatedResponse, build_paginated_response
from schemas.research import (
    ResearchMethodGroupCreate,
    ResearchMethodGroupResponse,
    ResearchMethodGroupUpdate,
)
from services.access_control import (
    enforce_lab_management_access,
    enforce_research_methods_read,
)
from services.research import (
    create_research_method_group,
    delete_research_method_group,
    get_research_method_groups,
    require_research_method_group_by_id,
    update_research_method_group,
)

router = APIRouter()


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
        200: {"description": "Список групп методов исследования успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def list_research_method_groups(
    db: DbSession,
    effective: UserPermissions,
    filters: PaginationSearchSortDep,
):
    enforce_research_methods_read(effective)
    groups, total = await get_research_method_groups(
        db,
        page=filters.page,
        page_size=filters.page_size,
        search=filters.search,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
    )
    return build_paginated_response(groups, total, filters.page, filters.page_size)


@router.post(
    "/research-method-groups/",
    response_model=ResearchMethodGroupResponse,
    status_code=201,
    summary="Добавление новой группы методов исследования",
    description="Добавляет новую группу методов исследования на основе переданных данных.",
    responses={
        201: {"description": "Группа методов исследования успешно добавлена"},
        400: {"description": "Некорректные данные для добавления группы методов исследования"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def create_research_method_group_endpoint(
    group_data: ResearchMethodGroupCreate,
    db: DbSession,
    effective: UserPermissions,
):
    enforce_lab_management_access(effective)
    return await create_research_method_group(db, group_data)


@router.get(
    "/research-method-groups/{group_id:int}/",
    response_model=ResearchMethodGroupResponse,
    summary="Получение группы методов исследования по ID",
    description="Возвращает информацию о группе методов исследования по её идентификатору.",
    responses={
        200: {"description": "Группа методов исследования успешно получена"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Группа методов исследования не найдена"},
    },
)
# @IsAuthenticated
async def get_research_method_group(
    group_id: int,
    db: DbSession,
    effective: UserPermissions,
    include_deleted: bool = Query(
        False,
        description="Включить скрытые группы (для сохранения связи при редактировании методики)",
    ),
):
    enforce_lab_management_access(effective)
    return await require_research_method_group_by_id(db, group_id, include_deleted=include_deleted)


@router.patch(
    "/research-method-groups/{group_id:int}/",
    response_model=ResearchMethodGroupResponse,
    summary="Обновление группы методов исследования",
    description="Обновляет существующую группу методов исследования.",
    responses={
        200: {"description": "Группа методов исследования успешно обновлена"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Группа методов исследования не найдена"},
    },
)
# @IsAuthenticated
async def update_research_method_group_endpoint(
    group_id: int,
    group_data: ResearchMethodGroupUpdate,
    db: DbSession,
    effective: UserPermissions,
):
    enforce_lab_management_access(effective)
    group = await require_research_method_group_by_id(db, group_id)
    return await update_research_method_group(db, group, group_data)


@router.delete(
    "/research-method-groups/{group_id:int}/",
    status_code=204,
    summary="Удаление группы методов исследования",
    description="Выполняет мягкое удаление группы методов исследования вместе с её методами.",
    responses={
        204: {"description": "Группа методов исследования успешно удалена"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Группа методов исследования не найдена"},
    },
)
# @IsAuthenticated
async def delete_research_method_group_endpoint(
    group_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    enforce_lab_management_access(effective)
    group = await require_research_method_group_by_id(db, group_id)
    await delete_research_method_group(db, group)
