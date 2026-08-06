from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ConflictError, NotFoundError
from models.role import Role
from repositories import role as role_repo
from repositories.base import flush_entity, refresh_entity
from schemas.role import (
    RoleCreate,
    RolePermissions,
    RoleResponse,
    RoleScopeBinding,
    RoleUpdate,
    scopes_to_storage,
)
from services.visibility import (
    apply_role_scope_labels,
    collect_role_scope_ids,
    enrich_role_scopes_labels,
    load_lab_dept_name_maps,
    validate_role_scopes_ids,
)
from utils.pagination import calculate_total_pages
from utils.role_scopes import normalize_role_scopes


def _build_role_response_from_labeled(
    item: Role,
    labeled_scopes: list[dict],
) -> RoleResponse:
    """Собрать RoleResponse из роли и уже подписанных привязок."""
    return RoleResponse(
        id=item.id,
        name=item.name,
        role_type=item.role_type,
        scopes=[
            RoleScopeBinding(
                laboratory_id=entry["laboratory_id"],
                department_id=entry.get("department_id"),
                permissions=RolePermissions.model_validate(entry["permissions"]),
                laboratory_name=entry.get("laboratory_name"),
                department_name=entry.get("department_name"),
            )
            for entry in labeled_scopes
        ],
        created_at=item.created_at,
        updated_at=item.updated_at,
        deleted_at=item.deleted_at,
    )


async def build_role_response(db: AsyncSession, item: Role) -> RoleResponse:
    """Собрать ответ API по роли с подписями привязок."""
    scopes = normalize_role_scopes(item.scopes)
    labeled_scopes = await enrich_role_scopes_labels(db, scopes)
    return _build_role_response_from_labeled(item, labeled_scopes)


async def build_roles_list_response(
    db: AsyncSession,
    items: list[Role],
) -> list[RoleResponse]:
    """Собрать ответы списка ролей с пакетной подгрузкой названий lab/dept."""
    normalized: list[tuple[Role, list[dict]]] = [
        (item, normalize_role_scopes(item.scopes)) for item in items
    ]
    laboratory_ids, department_ids = collect_role_scope_ids(
        [scopes for _, scopes in normalized]
    )
    lab_names, dept_names = await load_lab_dept_name_maps(
        db, laboratory_ids, department_ids
    )
    return [
        _build_role_response_from_labeled(
            item,
            apply_role_scope_labels(scopes, lab_names, dept_names),
        )
        for item, scopes in normalized
    ]


async def get_role_by_id(
    db: AsyncSession,
    role_id: int,
    include_deleted: bool = False,
) -> Role | None:
    """Получить роль по ID."""
    return await role_repo.get_role_by_id(db, role_id, include_deleted)


async def require_role_by_id(
    db: AsyncSession,
    role_id: int,
    include_deleted: bool = False,
) -> Role:
    """Получить роль по ID или вернуть 404."""
    item = await get_role_by_id(db, role_id, include_deleted)
    if not item:
        raise NotFoundError("Роль не найдена")
    return item


async def get_role_response(
    db: AsyncSession,
    role_id: int,
    include_deleted: bool = False,
) -> RoleResponse:
    """Получить ответ API по роли."""
    item = await require_role_by_id(db, role_id, include_deleted)
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
    responses = await build_roles_list_response(db, items)

    if page_size:
        total_pages = calculate_total_pages(total, page_size)
    else:
        total_pages = 1 if total > 0 else 0
    return responses, total, total_pages


async def create_role(db: AsyncSession, data: RoleCreate) -> RoleResponse:
    """Создать роль в справочнике."""
    if await role_repo.exists_role_by_name_and_type(db, data.name, data.role_type):
        raise ConflictError("Роль с таким наименованием и типом уже существует")

    scopes = scopes_to_storage(data.scopes)
    await validate_role_scopes_ids(db, scopes)

    item = Role(
        name=data.name,
        role_type=data.role_type,
        scopes=scopes,
    )
    item = await role_repo.add_role(db, item)
    return await build_role_response(db, item)


async def update_role(
    db: AsyncSession,
    role_id: int,
    data: RoleUpdate,
) -> RoleResponse:
    """Обновить роль в справочнике."""
    item = await require_role_by_id(db, role_id)

    if data.name is not None and data.name != item.name:
        if data.name.lower() != item.name.lower():
            if await role_repo.exists_role_by_name_and_type(
                db,
                data.name,
                data.role_type or item.role_type,
                exclude_id=role_id,
            ):
                raise ConflictError("Роль с таким наименованием и типом уже существует")
        item.name = data.name

    if data.role_type is not None:
        if data.role_type != item.role_type:
            if await role_repo.exists_role_by_name_and_type(
                db,
                item.name,
                data.role_type,
                exclude_id=role_id,
            ):
                raise ConflictError("Роль с таким наименованием и типом уже существует")
        item.role_type = data.role_type

    if data.scopes is not None:
        scopes = scopes_to_storage(data.scopes)
        await validate_role_scopes_ids(db, scopes)
        item.scopes = scopes

    await flush_entity(db)
    await refresh_entity(db, item)
    return await build_role_response(db, item)


async def delete_role(db: AsyncSession, role_id: int) -> None:
    """Мягко удалить роль из справочника."""
    item = await require_role_by_id(db, role_id)
    item.soft_delete()
    await flush_entity(db)


__all__ = [
    "build_role_response",
    "build_roles_list_response",
    "get_role_by_id",
    "require_role_by_id",
    "get_role_response",
    "get_roles_list",
    "create_role",
    "update_role",
    "delete_role",
]
