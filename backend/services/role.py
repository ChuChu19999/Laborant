from __future__ import annotations
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import set_committed_value
from core.exceptions import ConflictError, NotFoundError
from models.role import Role
from repositories import role as role_repo
from repositories.base import flush_entity, refresh_entity
from schemas.role import (
    RoleCreate,
    RolePermissions,
    RoleResponse,
    RoleScopeBinding,
    RoleScopeBindingInput,
    RoleUpdate,
)
from services.visibility import (
    apply_role_scope_labels,
    collect_role_scope_ids,
    enrich_role_scopes_labels,
    load_lab_dept_name_maps,
    validate_role_scopes_ids,
)
from utils.permissions_constants import default_role_permissions, normalize_permissions
from utils.role_scopes import normalize_role_scopes


def permissions_to_dict(
    permissions: RolePermissions | dict[str, Any] | None,
) -> dict[str, Any]:
    """Сериализовать permissions в dict для сохранения в БД."""
    if permissions is None:
        return default_role_permissions()
    if isinstance(permissions, RolePermissions):
        return normalize_permissions(permissions.model_dump())
    return normalize_permissions(permissions)


def scopes_to_storage(
    scopes: list[RoleScopeBindingInput] | list[RoleScopeBinding],
) -> list[dict[str, Any]]:
    """Сериализовать привязки прав роли для сохранения в БД."""
    raw = [
        {
            "laboratory_id": item.laboratory_id,
            "department_id": item.department_id,
            "permissions": permissions_to_dict(item.permissions),
        }
        for item in scopes
    ]
    return normalize_role_scopes(raw)


async def _attach_role_scope_labels(db: AsyncSession, item: Role) -> Role:
    """Добавить названия лабораторий и подразделений в привязки роли без пометки ORM изменённым."""
    scopes = normalize_role_scopes(item.scopes)
    labeled_scopes = await enrich_role_scopes_labels(db, scopes)
    set_committed_value(item, "scopes", labeled_scopes)
    return item


async def attach_role_scope_labels_batch(db: AsyncSession, items: list[Role]) -> list[Role]:
    """Добавить названия в привязки списка ролей одной пакетной загрузкой справочников."""
    normalized: list[tuple[Role, list[dict]]] = [(item, normalize_role_scopes(item.scopes)) for item in items]
    laboratory_ids, department_ids = collect_role_scope_ids([scopes for _, scopes in normalized])
    lab_names, dept_names = await load_lab_dept_name_maps(db, laboratory_ids, department_ids)
    for item, scopes in normalized:
        set_committed_value(item, "scopes", apply_role_scope_labels(scopes, lab_names, dept_names))
    return items


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
    """Вернуть роль по ID, иначе вызвать NotFoundError."""
    item = await get_role_by_id(db, role_id, include_deleted)
    if not item:
        raise NotFoundError("Роль не найдена")
    return item


async def get_role_for_response(
    db: AsyncSession,
    role_id: int,
    include_deleted: bool = False,
) -> RoleResponse:
    """Получить роль для ответа API с названиями в привязках лабораторий и подразделений."""
    item = await require_role_by_id(db, role_id, include_deleted)
    labeled = await _attach_role_scope_labels(db, item)
    return build_role_response(labeled)


async def get_roles_list(
    db: AsyncSession,
    page: int | None = None,
    page_size: int | None = None,
    search: str | None = None,
    role_type: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> tuple[list[RoleResponse], int]:
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
    labeled = await attach_role_scope_labels_batch(db, items)

    return [build_role_response(item) for item in labeled], total


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
    labeled = await _attach_role_scope_labels(db, item)
    return build_role_response(labeled)


async def update_role(
    db: AsyncSession,
    item: Role,
    data: RoleUpdate,
) -> RoleResponse:
    """Обновить роль в справочнике."""
    if data.name is not None and data.name != item.name:
        if data.name.lower() != item.name.lower() and await role_repo.exists_role_by_name_and_type(
            db,
            data.name,
            data.role_type or item.role_type,
            exclude_id=item.id,
        ):
            raise ConflictError("Роль с таким наименованием и типом уже существует")
        item.name = data.name

    if data.role_type is not None:
        if data.role_type != item.role_type and await role_repo.exists_role_by_name_and_type(
            db,
            item.name,
            data.role_type,
            exclude_id=item.id,
        ):
            raise ConflictError("Роль с таким наименованием и типом уже существует")
        item.role_type = data.role_type

    if data.scopes is not None:
        scopes = scopes_to_storage(data.scopes)
        await validate_role_scopes_ids(db, scopes)
        item.scopes = scopes

    await flush_entity(db)
    await refresh_entity(db, item)
    labeled = await _attach_role_scope_labels(db, item)
    return build_role_response(labeled)


async def delete_role(db: AsyncSession, item: Role) -> None:
    """Мягко удалить роль из справочника."""
    item.soft_delete()
    await flush_entity(db)


def build_role_response(item: Role) -> RoleResponse:
    """Собрать RoleResponse из ORM-роли."""
    return RoleResponse.model_validate(item)


__all__ = [
    "attach_role_scope_labels_batch",
    "build_role_response",
    "create_role",
    "delete_role",
    "get_role_by_id",
    "get_role_for_response",
    "get_roles_list",
    "require_role_by_id",
    "update_role",
]
