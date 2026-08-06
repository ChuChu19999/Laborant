import { defaultRolePermissions } from '../../config/permissions';
import type { RoleScopeBinding } from '../../api/roles';
import type { RolePermissions } from '../../config/permissions';

export function scopeBindingKey(binding: {
  laboratory_id: number;
  department_id?: number | null;
}): string {
  return binding.department_id != null
    ? `department:${binding.department_id}`
    : `laboratory:${binding.laboratory_id}`;
}

export function resolvePermissionsForScope(
  scopes: RoleScopeBinding[] | null | undefined,
  laboratoryId?: number | null,
  departmentId?: number | null
): RolePermissions | null {
  if (!scopes || scopes.length === 0) {
    return null;
  }

  if (laboratoryId == null && departmentId == null) {
    return null;
  }

  if (departmentId != null) {
    const exact = scopes.find(scope => scope.department_id === departmentId);
    if (exact) {
      return exact.permissions;
    }
    if (laboratoryId != null) {
      const labLevel = scopes.find(
        scope => scope.laboratory_id === laboratoryId && scope.department_id == null
      );
      if (labLevel) {
        return labLevel.permissions;
      }
    }
    return null;
  }

  if (laboratoryId != null) {
    const labLevel = scopes.find(
      scope => scope.laboratory_id === laboratoryId && scope.department_id == null
    );
    if (labLevel) {
      return labLevel.permissions;
    }
    const anyForLab = scopes.filter(scope => scope.laboratory_id === laboratoryId);
    if (anyForLab.length === 0) {
      return null;
    }
    return anyForLab[0]?.permissions ?? null;
  }

  return null;
}

export function canAccessLaboratoryFromScopes(
  scopes: RoleScopeBinding[] | null | undefined,
  laboratoryId: number
): boolean {
  if (!scopes || scopes.length === 0) {
    return false;
  }
  return scopes.some(scope => scope.laboratory_id === laboratoryId);
}

export function canAccessDepartmentFromScopes(
  scopes: RoleScopeBinding[] | null | undefined,
  laboratoryId: number,
  departmentId: number
): boolean {
  if (!scopes || scopes.length === 0) {
    return false;
  }
  if (scopes.some(scope => scope.department_id === departmentId)) {
    return true;
  }
  return scopes.some(scope => scope.laboratory_id === laboratoryId && scope.department_id == null);
}

export function emptyPermissionsFallback(): RolePermissions {
  return defaultRolePermissions();
}
