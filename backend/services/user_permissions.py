from __future__ import annotations
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from core.exceptions import ForbiddenError
from core.security import get_user_roles, is_admin_user
from repositories import role as role_repo
from schemas.role import (
    RolePermissions,
    UserPermissionsResponse,
)
from schemas.visibility import VisibilityScope, VisibilityScopeEntity
from services.visibility import enrich_visibility_scope_labels
from utils.permissions_constants import (
    full_admin_permissions,
    has_permission,
    merge_permissions,
    merge_visibility_scopes,
    normalize_permissions,
)
from utils.visibility_scope import (
    is_visible_in_scope,
    normalize_visibility_scope,
)


def _denied_response() -> UserPermissionsResponse:
    return UserPermissionsResponse(
        access_granted=False,
        is_admin=False,
        role_names=[],
        role_types=[],
        permissions=RolePermissions.default(),
        visibility_scope=VisibilityScope(),
    )


async def resolve_user_permissions(
    db: AsyncSession,
    decoded_token: dict,
) -> UserPermissionsResponse:
    """Собрать права пользователя из токена и справочника ролей."""
    token_roles = get_user_roles(decoded_token)
    if not token_roles:
        return _denied_response()

    if is_admin_user(decoded_token):
        return UserPermissionsResponse(
            access_granted=True,
            is_admin=True,
            role_names=token_roles,
            role_types=["admin"],
            permissions=RolePermissions.model_validate(full_admin_permissions()),
            visibility_scope=VisibilityScope(
                laboratory_ids=[],
                department_ids=[],
            ),
        )

    catalog_roles = await role_repo.get_roles_by_names(db, token_roles)
    found_names = {role.name for role in catalog_roles}
    if len(found_names) != len(set(token_roles)):
        return _denied_response()

    merged_permissions = merge_permissions(
        [normalize_permissions(role.permissions) for role in catalog_roles]
    )
    merged_scope = merge_visibility_scopes(
        [role.visibility_scope for role in catalog_roles]
    )
    labels = await enrich_visibility_scope_labels(db, merged_scope)
    role_types = sorted({role.role_type for role in catalog_roles})

    return UserPermissionsResponse(
        access_granted=True,
        is_admin=False,
        role_names=[role.name for role in catalog_roles],
        role_types=role_types,
        permissions=RolePermissions.model_validate(merged_permissions),
        visibility_scope=VisibilityScope(
            laboratory_ids=merged_scope.get("laboratory_ids", []),
            department_ids=merged_scope.get("department_ids", []),
            laboratories=[
                VisibilityScopeEntity(**entry)
                for entry in labels.get("laboratories", [])
            ],
            departments=[
                VisibilityScopeEntity(**entry)
                for entry in labels.get("departments", [])
            ],
        ),
    )


async def get_user_permissions_or_raise(
    db: AsyncSession,
    decoded_token: dict,
) -> UserPermissionsResponse:
    """Получить права пользователя или выбросить ForbiddenError."""
    result = await resolve_user_permissions(db, decoded_token)
    if not result.access_granted:
        raise ForbiddenError("Отказано в доступе")
    return result


def require_permission_in_effective(
    user_permissions: UserPermissionsResponse,
    resource: str,
    action: str,
) -> None:
    """Проверить право; admin всегда проходит."""
    if user_permissions.is_admin:
        return
    permissions = user_permissions.permissions.model_dump()
    if not has_permission(permissions, resource, action):
        raise ForbiddenError("Отказано в доступе")


def require_scope_access(
    user_permissions: UserPermissionsResponse,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> None:
    """Проверить доступ к лаборатории/подразделению по visibility_scope."""
    if user_permissions.is_admin:
        return
    scope = {
        "laboratory_ids": user_permissions.visibility_scope.laboratory_ids,
        "department_ids": user_permissions.visibility_scope.department_ids,
    }
    if laboratory_id is None and department_id is None:
        return
    if not is_visible_in_scope(scope, laboratory_id, department_id):
        raise ForbiddenError("Отказано в доступе к выбранной области")


def get_scope_filter_dict(
    user_permissions: UserPermissionsResponse,
) -> dict[str, list[int]]:
    """Вернуть scope для фильтрации списков (пустой = без ограничений)."""
    if user_permissions.is_admin:
        return {"laboratory_ids": [], "department_ids": []}
    return normalize_visibility_scope(
        {
            "laboratory_ids": user_permissions.visibility_scope.laboratory_ids,
            "department_ids": user_permissions.visibility_scope.department_ids,
        }
    )


def permissions_dict(user_permissions: UserPermissionsResponse) -> dict[str, Any]:
    """Permissions как dict."""
    return normalize_permissions(user_permissions.permissions.model_dump())


__all__ = [
    "resolve_user_permissions",
    "get_user_permissions_or_raise",
    "require_permission_in_effective",
    "require_scope_access",
    "get_scope_filter_dict",
    "permissions_dict",
]
