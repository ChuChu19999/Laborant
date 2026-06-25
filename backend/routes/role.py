from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.exceptions import NotFoundError
from core.security import IsAuthenticated
from schemas.pagination import PaginatedResponse
from schemas.role import RoleCreate, RoleResponse, RoleUpdate
from schemas.test_object import VisibilityScope, VisibilityScopeEntity
from services.role import (
    create_role,
    delete_role,
    enrich_visibility_scope_labels,
    get_role_by_id,
    get_roles_list,
    update_role,
)
from utils.test_object_visibility import normalize_visibility_scope

router = APIRouter()


def _snapshot_role(item) -> Dict[str, Any]:
    return {
        "id": item.id,
        "name": item.name,
        "role_type": item.role_type,
        "visibility_scope": normalize_visibility_scope(item.visibility_scope),
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "deleted_at": item.deleted_at,
    }


def _to_response(
    item_data: Dict[str, Any], visibility_labels: Optional[dict] = None
) -> RoleResponse:
    scope = normalize_visibility_scope(item_data["visibility_scope"])
    laboratories = []
    departments = []
    if visibility_labels:
        laboratories = [
            VisibilityScopeEntity(**entry)
            for entry in visibility_labels.get("laboratories", [])
        ]
        departments = [
            VisibilityScopeEntity(**entry)
            for entry in visibility_labels.get("departments", [])
        ]
    return RoleResponse(
        id=item_data["id"],
        name=item_data["name"],
        role_type=item_data["role_type"],
        visibility_scope=VisibilityScope(
            laboratory_ids=scope.get("laboratory_ids", []),
            department_ids=scope.get("department_ids", []),
            laboratories=laboratories,
            departments=departments,
        ),
        created_at=item_data["created_at"],
        updated_at=item_data["updated_at"],
        deleted_at=item_data["deleted_at"],
    )


@router.get(
    "/roles/",
    response_model=PaginatedResponse[RoleResponse],
    summary="Справочник ролей",
    description="Возвращает список ролей с пагинацией. Поддерживает поиск и сортировку.",
)
# @IsAuthenticated
async def list_roles(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    search: Optional[str] = Query(None),
    role_type: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("asc"),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает справочник ролей."""
    items, total, total_pages = await get_roles_list(
        db,
        page=page,
        page_size=page_size,
        search=search,
        role_type=role_type,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    response_items = []
    for item in items:
        await db.refresh(item)
        item_data = _snapshot_role(item)
        labels = await enrich_visibility_scope_labels(db, item_data["visibility_scope"])
        response_items.append(_to_response(item_data, labels))

    return PaginatedResponse(
        items=response_items,
        total=total,
        page=page or 1,
        page_size=page_size or total,
        total_pages=total_pages,
    )


@router.get(
    "/roles/{role_id}/",
    response_model=RoleResponse,
    summary="Роль по ID",
)
# @IsAuthenticated
async def get_role_endpoint(
    role_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Возвращает роль по ID."""
    item = await get_role_by_id(db, role_id)
    if not item:
        raise NotFoundError("Область видимости роли не найдена")
    await db.refresh(item)
    item_data = _snapshot_role(item)
    labels = await enrich_visibility_scope_labels(db, item_data["visibility_scope"])
    return _to_response(item_data, labels)


@router.post(
    "/roles/",
    response_model=RoleResponse,
    status_code=201,
    summary="Создать роль",
)
# @IsAuthenticated
async def create_role_endpoint(
    data: RoleCreate,
    db: AsyncSession = Depends(get_db),
):
    """Создает запись в справочнике ролей."""
    item = await create_role(db, data)
    await db.commit()
    await db.refresh(item)
    item_data = _snapshot_role(item)
    labels = await enrich_visibility_scope_labels(db, item_data["visibility_scope"])
    return _to_response(item_data, labels)


@router.patch(
    "/roles/{role_id}/",
    response_model=RoleResponse,
    summary="Обновить роль",
)
# @IsAuthenticated
async def update_role_endpoint(
    role_id: int,
    data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновляет запись в справочнике ролей."""
    item = await update_role(db, role_id, data)
    await db.commit()
    await db.refresh(item)
    item_data = _snapshot_role(item)
    labels = await enrich_visibility_scope_labels(db, item_data["visibility_scope"])
    return _to_response(item_data, labels)


@router.delete(
    "/roles/{role_id}/",
    status_code=204,
    summary="Удалить роль",
)
# @IsAuthenticated
async def delete_role_endpoint(
    role_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Мягко удаляет роль из справочника."""
    await delete_role(db, role_id)
    await db.commit()
