from __future__ import annotations
from collections.abc import Callable
from core.exceptions import ForbiddenError
from schemas.role import RolePermissions, UserPermissionsResponse
from services.user_permissions import (
    get_effective_role_permissions,
    require_permission_in_effective,
    require_scope_access,
)
from utils.permissions_constants import (
    EnforceCrudAction,
    EnforceCrudResource,
    NavigationKey,
    PermissionAction,
    PermissionResource,
    SamplesMutationAction,
)


def _enforce_permission_and_scope(
    effective: UserPermissionsResponse,
    resource: PermissionResource,
    action: PermissionAction,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> None:
    """Проверить одно право и область видимости."""
    require_permission_in_effective(effective, resource, action, laboratory_id, department_id)
    require_scope_access(effective, laboratory_id, department_id)


def _enforce_any_permission_and_scope(
    effective: UserPermissionsResponse,
    is_allowed: Callable[[RolePermissions], bool],
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> None:
    """Проверить, что есть хотя бы одно из прав, и область видимости."""
    perms = get_effective_role_permissions(effective, laboratory_id, department_id)
    if not is_allowed(perms):
        raise ForbiddenError("Отказано в доступе")
    require_scope_access(effective, laboratory_id, department_id)


def enforce_nav_access(
    effective: UserPermissionsResponse,
    nav_key: NavigationKey,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> None:
    """Разрешить доступ к разделу навигации в выбранной области."""
    _enforce_permission_and_scope(effective, "navigation", nav_key, laboratory_id, department_id)


def enforce_crud_access(
    effective: UserPermissionsResponse,
    resource: EnforceCrudResource,
    action: EnforceCrudAction,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> None:
    """Разрешить CRUD-действие над ресурсом в выбранной области."""
    _enforce_permission_and_scope(effective, resource, action, laboratory_id, department_id)


def enforce_lab_management_access(
    effective: UserPermissionsResponse,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> None:
    """Разрешить управление лабораториями, методами и фикстурами в области."""
    _enforce_permission_and_scope(effective, "laboratory_management", "access", laboratory_id, department_id)


def enforce_samples_mutation(
    effective: UserPermissionsResponse,
    action: SamplesMutationAction,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> None:
    """Разрешить изменение или удаление проб при доступе к разделу проб."""
    require_permission_in_effective(effective, "navigation", "samples", laboratory_id, department_id)
    require_permission_in_effective(effective, "samples", action, laboratory_id, department_id)
    require_scope_access(effective, laboratory_id, department_id)


def enforce_research_methods_read(
    effective: UserPermissionsResponse,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> None:
    """Разрешить чтение методов при праве на лаборатории, приборы, нормы, расчёты или пробы."""
    _enforce_any_permission_and_scope(
        effective,
        lambda perms: (
            perms.laboratory_management.access
            or perms.equipment.read
            or perms.nd_norms.read
            or perms.refraction_tables.read
            or perms.calculations.execute
            or perms.navigation.samples
        ),
        laboratory_id,
        department_id,
    )


def enforce_selection_conditions_read(
    effective: UserPermissionsResponse,
    laboratory_id: int | None = None,
    department_id: int | None = None,
) -> None:
    """Разрешить чтение условий отбора при управлении лабораториями или доступе к пробам."""
    _enforce_any_permission_and_scope(
        effective,
        lambda perms: perms.laboratory_management.access or perms.navigation.samples,
        laboratory_id,
        department_id,
    )


def resolve_calculations_read_access(
    effective: UserPermissionsResponse,
    laboratory_id: int | None,
    department_id: int | None,
) -> None:
    """Разрешить чтение расчётов по пробе: через раздел проб или право выполнять расчёты."""
    try:
        enforce_nav_access(effective, "samples", laboratory_id, department_id)
    except ForbiddenError:
        enforce_crud_access(effective, "calculations", "execute", laboratory_id, department_id)


__all__ = [
    "enforce_crud_access",
    "enforce_lab_management_access",
    "enforce_nav_access",
    "enforce_research_methods_read",
    "enforce_samples_mutation",
    "enforce_selection_conditions_read",
    "resolve_calculations_read_access",
]
