from __future__ import annotations
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ForbiddenError
from core.security import get_user_roles, is_admin_user
from repositories import role as role_repo
from schemas.role import (
    RolePermissions,
    RoleScopeBinding,
    UserPermissionsResponse,
)
from schemas.visibility import VisibilityScope
from services.visibility import (
    enrich_role_scopes_labels,
    enrich_visibility_scope_labels,
)
from utils.permissions_constants import (
    PermissionAction,
    PermissionResource,
    full_admin_permissions,
    has_permission,
    merge_permissions,
    normalize_permissions,
)
from utils.role_scopes import (
    merge_role_scopes,
    normalize_role_scopes,
    resolve_permissions_for_scope,
    role_scope_matches,
    scopes_to_visibility_scope,
)


def _denied_payload() -> dict[str, Any]:
    """Собрать ответ об отказе в доступе без прав."""
    return {
        "access_granted": False,
        "is_admin": False,
        "role_names": [],
        "role_types": [],
        "scopes": [],
        "permissions": RolePermissions.default().model_dump(),
        "visibility_scope": VisibilityScope().model_dump(),
    }


def _bindings_from_labeled(
    labeled_scopes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Собрать привязки роли из словарей области видимости с уже подставленными названиями."""
    return [
        {
            "laboratory_id": entry["laboratory_id"],
            "department_id": entry.get("department_id"),
            "permissions": RolePermissions.model_validate(entry["permissions"]).model_dump(),
            "laboratory_name": entry.get("laboratory_name"),
            "department_name": entry.get("department_name"),
        }
        for entry in labeled_scopes
    ]


def scopes_dicts_from_bindings(
    bindings: list[RoleScopeBinding],
) -> list[dict[str, Any]]:
    """Преобразовать привязки ответа в dict для utils/role_scopes."""
    return [
        {
            "laboratory_id": binding.laboratory_id,
            "department_id": binding.department_id,
            "permissions": binding.permissions.model_dump(),
        }
        for binding in bindings
    ]


async def resolve_user_permissions(
    db: AsyncSession,
    decoded_token: dict,
) -> dict[str, Any]:
    """Собрать права пользователя из токена и справочника ролей."""
    token_roles = get_user_roles(decoded_token)
    if not token_roles:
        return _denied_payload()

    if is_admin_user(decoded_token):
        return {
            "access_granted": True,
            "is_admin": True,
            "role_names": token_roles,
            "role_types": ["admin"],
            "scopes": [],
            "permissions": full_admin_permissions(),
            "visibility_scope": {
                "laboratory_ids": [],
                "department_ids": [],
            },
        }

    catalog_roles = await role_repo.get_roles_by_names(db, token_roles)
    found_names = {role.name for role in catalog_roles}
    if len(found_names) != len(set(token_roles)):
        return _denied_payload()

    merged_scopes = merge_role_scopes([normalize_role_scopes(role.scopes) for role in catalog_roles])
    labeled_scopes = await enrich_role_scopes_labels(db, merged_scopes)
    visibility = scopes_to_visibility_scope(merged_scopes)
    labels = await enrich_visibility_scope_labels(db, visibility)
    role_types = sorted({role.role_type for role in catalog_roles})
    if not role_types:
        return _denied_payload()

    if merged_scopes:
        merged_permissions = merge_permissions([entry["permissions"] for entry in merged_scopes])
    else:
        merged_permissions = normalize_permissions(None)

    return {
        "access_granted": True,
        "is_admin": False,
        "role_names": [role.name for role in catalog_roles],
        "role_types": role_types,
        "scopes": _bindings_from_labeled(labeled_scopes),
        "permissions": normalize_permissions(merged_permissions),
        "visibility_scope": {
            "laboratory_ids": visibility.get("laboratory_ids", []),
            "department_ids": visibility.get("department_ids", []),
            "laboratories": labels.get("laboratories", []),
            "departments": labels.get("departments", []),
        },
    }


async def get_user_permissions_or_raise(
    db: AsyncSession,
    decoded_token: dict,
) -> UserPermissionsResponse:
    """Вернуть права пользователя, иначе вызвать ForbiddenError."""
    result = await resolve_user_permissions(db, decoded_token)
    if not result["access_granted"]:
        raise ForbiddenError("Отказано в доступе")
    return UserPermissionsResponse.model_validate(result)


def _effective_permissions_dict(
    user_permissions: UserPermissionsResponse,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> dict[str, Any] | None:
    """Вернуть права в контексте lab/dept или объединённые без контекста."""
    if user_permissions.is_admin:
        return full_admin_permissions()

    scopes = scopes_dicts_from_bindings(user_permissions.scopes)

    if laboratory_id is None and department_id is None:
        return normalize_permissions(user_permissions.permissions.model_dump())

    return resolve_permissions_for_scope(scopes, laboratory_id, department_id)


def get_effective_role_permissions(
    user_permissions: UserPermissionsResponse,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> RolePermissions:
    """Вернуть права в контексте lab/dept; без доступа к области — ForbiddenError."""
    if user_permissions.is_admin:
        return RolePermissions.model_validate(full_admin_permissions())
    if laboratory_id is None and department_id is None:
        return user_permissions.permissions
    resolved = resolve_permissions_for_scope(
        scopes_dicts_from_bindings(user_permissions.scopes),
        laboratory_id,
        department_id,
    )
    if resolved is None:
        raise ForbiddenError("Отказано в доступе")
    return RolePermissions.model_validate(resolved)


def require_permission_in_effective(
    user_permissions: UserPermissionsResponse,
    resource: PermissionResource,
    action: PermissionAction,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> None:
    """Проверить право; администратор допускается всегда. Иначе — по привязке к лаборатории/подразделению."""
    if user_permissions.is_admin:
        return
    permissions = _effective_permissions_dict(user_permissions, laboratory_id, department_id)
    if permissions is None or not has_permission(permissions, resource, action):
        raise ForbiddenError("Отказано в доступе")


def require_scope_access(
    user_permissions: UserPermissionsResponse,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> None:
    """Проверить доступ к лаборатории/подразделению по привязкам роли."""
    if user_permissions.is_admin:
        return
    if laboratory_id is None and department_id is None:
        return
    scopes = scopes_dicts_from_bindings(user_permissions.scopes)
    if not role_scope_matches(scopes, laboratory_id, department_id):
        raise ForbiddenError("Отказано в доступе к выбранной области")


__all__ = [
    "get_effective_role_permissions",
    "get_user_permissions_or_raise",
    "require_permission_in_effective",
    "require_scope_access",
    "resolve_user_permissions",
    "scopes_dicts_from_bindings",
]
