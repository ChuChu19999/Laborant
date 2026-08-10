from __future__ import annotations
from fastapi import APIRouter, Query
from core.deps import DbSession, UserPermissions
from schemas.pagination import PaginatedResponse
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
    build_research_method_group_response,
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
    responses={200: {"description": "Список групп методов исследования успешно получен"}},
)
# @IsAuthenticated
async def list_research_method_groups(
    db: DbSession,
    effective: UserPermissions,
    page: int | None = Query(None, ge=1),
    page_size: int | None = Query(None, ge=1, le=100),
    search: str | None = Query(None),
    sort_by: str | None = Query(None),
    sort_order: str | None = Query("desc"),
):
    """Возвращает список групп методов исследования с пагинацией или без."""
    enforce_research_methods_read(effective)
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
        400: {"description": "Некорректные данные для добавления группы методов исследования"},
    },
)
# @IsAuthenticated
async def create_research_method_group_endpoint(
    group_data: ResearchMethodGroupCreate,
    db: DbSession,
    effective: UserPermissions,
):
    """Добавляет новую группу методов исследования на основе переданных данных."""
    enforce_lab_management_access(effective)
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
    effective: UserPermissions,
    include_deleted: bool = Query(
        False,
        description="Включить скрытые группы (для сохранения связи при редактировании методики)",
    ),
):
    """Возвращает информацию о группе методов исследования по ее идентификатору."""
    enforce_lab_management_access(effective)
    group = await require_research_method_group_by_id(db, group_id, include_deleted=include_deleted)
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
    effective: UserPermissions,
):
    """Обновляет существующую группу методов исследования."""
    enforce_lab_management_access(effective)
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
    effective: UserPermissions,
):
    """Выполняет мягкое удаление группы методов исследования вместе с ее методами."""
    enforce_lab_management_access(effective)
    await delete_research_method_group(db, group_id)
