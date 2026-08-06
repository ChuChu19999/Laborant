from __future__ import annotations
from core.exceptions import ForbiddenError
from schemas.role import RolePermissions, UserPermissionsResponse
from services.user_permissions import (
    get_scope_filter_dict,
    require_permission_in_effective,
    require_scope_access,
    scopes_dicts_from_bindings,
)
from utils.role_scopes import resolve_permissions_for_scope


def enforce_nav_access(
    effective: UserPermissionsResponse,
    nav_key: str,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> dict[str, list[int]]:
    """Проверка доступа к разделу навигации и области видимости."""
    require_permission_in_effective(
        effective, "navigation", nav_key, laboratory_id, department_id
    )
    require_scope_access(effective, laboratory_id, department_id)
    return get_scope_filter_dict(effective)


def enforce_crud_access(
    effective: UserPermissionsResponse,
    resource: str,
    action: str,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> dict[str, list[int]]:
    """Проверка CRUD-права и области видимости."""
    require_permission_in_effective(
        effective, resource, action, laboratory_id, department_id
    )
    require_scope_access(effective, laboratory_id, department_id)
    return get_scope_filter_dict(effective)


def enforce_lab_management_access(
    effective: UserPermissionsResponse,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> dict[str, list[int]]:
    """Проверка доступа к управлению лабораториями / методам / fixtures."""
    require_permission_in_effective(
        effective, "laboratory_management", "access", laboratory_id, department_id
    )
    require_scope_access(effective, laboratory_id, department_id)
    return get_scope_filter_dict(effective)


def enforce_samples_mutation(
    effective: UserPermissionsResponse,
    action: str,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> None:
    """Проверка прав на изменение/удаление проб."""
    require_permission_in_effective(
        effective, "navigation", "samples", laboratory_id, department_id
    )
    require_permission_in_effective(
        effective, "samples", action, laboratory_id, department_id
    )
    require_scope_access(effective, laboratory_id, department_id)


def enforce_research_methods_read(
    effective: UserPermissionsResponse,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> dict[str, list[int]]:
    """Чтение методов: управление лабораториями, приборы, нормы, расчёты или пробы."""
    if effective.is_admin:
        require_scope_access(effective, laboratory_id, department_id)
        return get_scope_filter_dict(effective)

    if laboratory_id is None and department_id is None:
        perms = effective.permissions
    else:
        resolved = resolve_permissions_for_scope(
            scopes_dicts_from_bindings(effective.scopes), laboratory_id, department_id
        )
        if resolved is None:
            raise ForbiddenError("Отказано в доступе")
        perms = RolePermissions.model_validate(resolved)

    allowed = (
        perms.laboratory_management.access
        or perms.equipment.read
        or perms.nd_norms.read
        or perms.refraction_tables.read
        or perms.calculations.execute
        or perms.navigation.samples
    )
    if not allowed:
        raise ForbiddenError("Отказано в доступе")
    require_scope_access(effective, laboratory_id, department_id)
    return get_scope_filter_dict(effective)


def enforce_selection_conditions_read(
    effective: UserPermissionsResponse,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> dict[str, list[int]]:
    """Чтение справочника условий отбора: управление лабораториями или пробы."""
    if effective.is_admin:
        require_scope_access(effective, laboratory_id, department_id)
        return get_scope_filter_dict(effective)

    if laboratory_id is None and department_id is None:
        perms = effective.permissions
    else:
        resolved = resolve_permissions_for_scope(
            scopes_dicts_from_bindings(effective.scopes), laboratory_id, department_id
        )
        if resolved is None:
            raise ForbiddenError("Отказано в доступе")
        perms = RolePermissions.model_validate(resolved)

    if not (perms.laboratory_management.access or perms.navigation.samples):
        raise ForbiddenError("Отказано в доступе")
    require_scope_access(effective, laboratory_id, department_id)
    return get_scope_filter_dict(effective)


__all__ = [
    "enforce_nav_access",
    "enforce_crud_access",
    "enforce_lab_management_access",
    "enforce_samples_mutation",
    "enforce_research_methods_read",
    "enforce_selection_conditions_read",
]
