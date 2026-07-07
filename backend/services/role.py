from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError
from models.role import Role
from repositories import role as role_repo
from repositories.base import flush_entity, refresh_entity
from schemas.role import RoleCreate, RoleResponse, RoleUpdate, visibility_scope_to_dict
from schemas.test_object import VisibilityScope, VisibilityScopeEntity
from services.visibility import enrich_visibility_scope_labels
from utils.pagination import calculate_total_pages
from utils.test_object_visibility import normalize_visibility_scope


def _serialize_role(item: Role) -> Role:
    item.visibility_scope = normalize_visibility_scope(item.visibility_scope)
    return item


async def build_role_response(db: AsyncSession, item: Role) -> RoleResponse:
    """Собрать ответ API по роли с подписями области видимости."""
    scope = item.visibility_scope
    labels = await enrich_visibility_scope_labels(db, scope)
    return RoleResponse(
        id=item.id,
        name=item.name,
        role_type=item.role_type,
        visibility_scope=VisibilityScope(
            laboratory_ids=scope.get("laboratory_ids", []),
            department_ids=scope.get("department_ids", []),
            laboratories=[
                VisibilityScopeEntity(**entry)
                for entry in labels.get("laboratories", [])
            ],
            departments=[
                VisibilityScopeEntity(**entry)
                for entry in labels.get("departments", [])
            ],
        ),
        created_at=item.created_at,
        updated_at=item.updated_at,
        deleted_at=item.deleted_at,
    )


async def get_role_by_id(
    db: AsyncSession,
    role_id: int,
    include_deleted: bool = False,
) -> Role | None:
    """Получить роль по ID."""
    item = await role_repo.get_role_by_id(db, role_id, include_deleted)
    if item:
        return _serialize_role(item)
    return None


async def get_role_response(
    db: AsyncSession,
    role_id: int,
    include_deleted: bool = False,
) -> RoleResponse | None:
    """Получить ответ API по роли."""
    item = await get_role_by_id(db, role_id, include_deleted)
    if not item:
        return None
    return await build_role_response(db, item)


async def get_roles_list(
    db: AsyncSession,
    page: int | None = None,
    page_size: int | None = None,
    search: str | None = None,
    role_type: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[RoleResponse], int, int]:
    """Получить список ролей из справочника."""
    items, total = await role_repo.get_roles(
        db,
        search,
        role_type,
        sort_by,
        sort_order,
        page,
        page_size,
    )
    serialized = [_serialize_role(item) for item in items]
    responses = [await build_role_response(db, item) for item in serialized]

    if page_size:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0
    return responses, total, total_pages


async def create_role(db: AsyncSession, data: RoleCreate) -> RoleResponse:
    """Создать роль в справочнике."""
    if await role_repo.exists_role_by_name_and_type(db, data.name, data.role_type):
        raise ConflictError(
            "Область видимости роли с таким наименованием и типом уже существует"
        )

    item = Role(
        name=data.name,
        role_type=data.role_type,
        visibility_scope=visibility_scope_to_dict(data.visibility_scope),
    )
    item = await role_repo.add_role(db, item)
    return await build_role_response(db, _serialize_role(item))


async def update_role(
    db: AsyncSession,
    role_id: int,
    data: RoleUpdate,
) -> RoleResponse:
    """Обновить роль в справочнике."""
    item = await get_role_by_id(db, role_id)
    if not item:
        raise NotFoundError("Роль не найдена")

    if data.name is not None and data.name != item.name:
        if data.name.lower() != item.name.lower():
            if await role_repo.exists_role_by_name_and_type(
                db,
                data.name,
                data.role_type or item.role_type,
                exclude_id=role_id,
            ):
                raise ConflictError(
                    "Область видимости роли с таким наименованием и типом уже существует"
                )
        item.name = data.name

    if data.role_type is not None:
        if data.role_type != item.role_type:
            if await role_repo.exists_role_by_name_and_type(
                db,
                item.name,
                data.role_type,
                exclude_id=role_id,
            ):
                raise ConflictError(
                    "Область видимости роли с таким наименованием и типом уже существует"
                )
        item.role_type = data.role_type

    if data.visibility_scope is not None:
        item.visibility_scope = visibility_scope_to_dict(data.visibility_scope)

    await flush_entity(db)
    await refresh_entity(db, item)
    return await build_role_response(db, _serialize_role(item))


async def delete_role(db: AsyncSession, role_id: int) -> None:
    """Мягко удалить роль из справочника."""
    item = await get_role_by_id(db, role_id)
    if not item:
        raise NotFoundError("Роль не найдена")
    item.soft_delete()
    await flush_entity(db)


__all__ = [
    "build_role_response",
    "get_role_by_id",
    "get_role_response",
    "get_roles_list",
    "create_role",
    "update_role",
    "delete_role",
]
