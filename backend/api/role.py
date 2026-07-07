from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from core.auth_decorators import IsAuthenticated
from core.database import get_db
from core.exceptions import NotFoundError
from schemas.pagination import PaginatedResponse
from schemas.role import RoleCreate, RoleResponse, RoleUpdate
from services.role import (
    create_role,
    delete_role,
    get_role_response,
    get_roles_list,
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
    responses={200: {"description": "Список ролей успешно получен"}},
)
# @IsAuthenticated
async def list_roles(
    page: int | None = Query(None, ge=1),
    page_size: int | None = Query(None, ge=1, le=100),
    search: str | None = Query(None),
    role_type: str | None = Query(None),
    sort_by: str | None = Query(None),
    sort_order: str | None = Query("asc"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает список ролей с пагинацией или без."""
    items, total, total_pages = await get_roles_list(
        db,
        page=page,
        page_size=page_size,
        search=search,
        role_type=role_type,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return PaginatedResponse(
        items=items,
        total=total,
        page=page if page is not None else 1,
        page_size=page_size if page_size is not None else total,
        total_pages=total_pages,
    )


@router.get(
    "/roles/{role_id}/",
    response_model=RoleResponse,
    summary="Получение роли по ID",
    description="Возвращает информацию о роли по ее идентификатору.",
    responses={
        200: {"description": "Роль успешно получена"},
        404: {"description": "Роль не найдена"},
    },
)
# @IsAuthenticated
async def get_role_endpoint(
    role_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Возвращает информацию о роли по ее идентификатору."""
    item = await get_role_response(db, role_id)
    if not item:
        raise NotFoundError("Роль не найдена")
    return item


@router.post(
    "/roles/",
    response_model=RoleResponse,
    status_code=201,
    summary="Добавление роли",
    description="Добавляет новую роль на основе переданных данных.",
    responses={
        201: {"description": "Роль успешно добавлена"},
        400: {"description": "Некорректные данные для добавления роли"},
    },
)
# @IsAuthenticated
async def create_role_endpoint(
    data: RoleCreate,
    db: AsyncSession = Depends(get_db),
):
    """Добавляет новую роль на основе переданных данных."""
    return await create_role(db, data)


@router.patch(
    "/roles/{role_id}/",
    response_model=RoleResponse,
    summary="Обновление роли",
    description="Обновляет существующую роль.",
    responses={
        200: {"description": "Роль успешно обновлена"},
        404: {"description": "Роль не найдена"},
    },
)
# @IsAuthenticated
async def update_role_endpoint(
    role_id: int,
    data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновляет существующую роль."""
    return await update_role(db, role_id, data)


@router.delete(
    "/roles/{role_id}/",
    status_code=204,
    summary="Удаление роли",
    description="Выполняет мягкое удаление роли.",
    responses={
        204: {"description": "Роль успешно удалена"},
        404: {"description": "Роль не найдена"},
    },
)
# @IsAuthenticated
async def delete_role_endpoint(
    role_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Выполняет мягкое удаление роли."""
    await delete_role(db, role_id)
