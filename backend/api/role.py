from __future__ import annotations
from fastapi import APIRouter
from core.deps import DbSession, RoleListFiltersDep, UserPermissions, require_admin
from schemas.pagination import PaginatedResponse, build_paginated_response
from schemas.role import RoleCreate, RoleResponse, RoleUpdate
from services.role import (
    create_role,
    delete_role,
    get_role_for_response,
    get_roles_list,
    require_role_by_id,
    update_role,
)

router = APIRouter()


@router.get(
    "/roles/",
    response_model=PaginatedResponse[RoleResponse],
    summary="Получение списка ролей",
    description=(
        "Возвращает список ролей с пагинацией или без. "
        "Если page и page_size не указаны, возвращает все записи. "
        "Поддерживает поиск и сортировку."
    ),
    responses={
        200: {"description": "Список ролей успешно получен"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def list_roles(
    db: DbSession,
    effective: UserPermissions,
    filters: RoleListFiltersDep,
):
    require_admin(effective)
    items, total = await get_roles_list(
        db,
        page=filters.page,
        page_size=filters.page_size,
        search=filters.search,
        role_type=filters.role_type,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
    )
    return build_paginated_response(items, total, filters.page, filters.page_size)


@router.get(
    "/roles/{role_id:int}/",
    response_model=RoleResponse,
    summary="Получение роли по ID",
    description="Возвращает информацию о роли по её идентификатору.",
    responses={
        200: {"description": "Роль успешно получена"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Роль не найдена"},
    },
)
# @IsAuthenticated
async def get_role_endpoint(
    role_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> RoleResponse:
    require_admin(effective)
    return await get_role_for_response(db, role_id)


@router.post(
    "/roles/",
    response_model=RoleResponse,
    status_code=201,
    summary="Добавление роли",
    description="Добавляет новую роль на основе переданных данных.",
    responses={
        201: {"description": "Роль успешно добавлена"},
        400: {"description": "Некорректные данные для добавления роли"},
        403: {"description": "Отказано в доступе"},
    },
)
# @IsAuthenticated
async def create_role_endpoint(
    data: RoleCreate,
    db: DbSession,
    effective: UserPermissions,
) -> RoleResponse:
    require_admin(effective)
    return await create_role(db, data)


@router.patch(
    "/roles/{role_id:int}/",
    response_model=RoleResponse,
    summary="Обновление роли",
    description="Обновляет существующую роль.",
    responses={
        200: {"description": "Роль успешно обновлена"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Роль не найдена"},
    },
)
# @IsAuthenticated
async def update_role_endpoint(
    role_id: int,
    data: RoleUpdate,
    db: DbSession,
    effective: UserPermissions,
) -> RoleResponse:
    require_admin(effective)
    role = await require_role_by_id(db, role_id)
    return await update_role(db, role, data)


@router.delete(
    "/roles/{role_id:int}/",
    status_code=204,
    summary="Удаление роли",
    description="Выполняет мягкое удаление роли.",
    responses={
        204: {"description": "Роль успешно удалена"},
        403: {"description": "Отказано в доступе"},
        404: {"description": "Роль не найдена"},
    },
)
# @IsAuthenticated
async def delete_role_endpoint(
    role_id: int,
    db: DbSession,
    effective: UserPermissions,
) -> None:
    require_admin(effective)
    role = await require_role_by_id(db, role_id)
    await delete_role(db, role)
