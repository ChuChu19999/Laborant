import {
  defaultRolePermissions,
  NAVIGATION_KEYS,
  type RolePermissions,
} from '../permissionsConfig';
import type { RoleScopeBinding } from '../../api/permissionTypes';

const CRUD_RESOURCES = [
  'protocols',
  'equipment',
  'sampling_locations',
  'sample_types',
  'test_purposes',
  'nd_norms',
  'refraction_tables',
] as const;

export function scopeBindingKey(binding: {
  laboratory_id: number;
  department_id?: number | null;
}): string {
  return binding.department_id != null
    ? `department:${binding.department_id}`
    : `laboratory:${binding.laboratory_id}`;
}

/** Объединить permissions. */
export function mergePermissions(items: RolePermissions[]): RolePermissions {
  if (items.length === 0) {
    return defaultRolePermissions();
  }

  const firstItem = items[0];
  if (firstItem == null) {
    return defaultRolePermissions();
  }

  const result: RolePermissions = structuredClone(firstItem);

  for (const other of items.slice(1)) {
    for (const key of NAVIGATION_KEYS) {
      result.navigation[key] = result.navigation[key] || other.navigation[key];
    }
    result.laboratory_management.access =
      result.laboratory_management.access || other.laboratory_management.access;
    result.samples.update = result.samples.update || other.samples.update;
    result.samples.delete = result.samples.delete || other.samples.delete;
    result.samples.visible_fields = Array.from(
      new Set([...result.samples.visible_fields, ...other.samples.visible_fields])
    ).sort();
    result.protocols.visible_fields = Array.from(
      new Set([...result.protocols.visible_fields, ...other.protocols.visible_fields])
    ).sort();
    result.sampling_locations.visible_fields = Array.from(
      new Set([
        ...result.sampling_locations.visible_fields,
        ...other.sampling_locations.visible_fields,
      ])
    ).sort();

    for (const resource of CRUD_RESOURCES) {
      result[resource].read = result[resource].read || other[resource].read;
      result[resource].create = result[resource].create || other[resource].create;
      result[resource].update = result[resource].update || other[resource].update;
      result[resource].delete = result[resource].delete || other[resource].delete;
    }

    result.calculations.execute = result.calculations.execute || other.calculations.execute;
    result.calculations.create = result.calculations.create || other.calculations.create;
    result.calculations.update = result.calculations.update || other.calculations.update;
    result.calculations.delete = result.calculations.delete || other.calculations.delete;
    result.calculations.show_equipment =
      result.calculations.show_equipment || other.calculations.show_equipment;

    // При расхождении терминологии приоритет у well_mode.
    if (
      result.sampling_terminology !== other.sampling_terminology &&
      (result.sampling_terminology === 'well_mode' || other.sampling_terminology === 'well_mode')
    ) {
      result.sampling_terminology = 'well_mode';
    }
  }

  for (const resource of CRUD_RESOURCES) {
    result[resource].read = Boolean(result.navigation[resource]);
  }

  return result;
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
    const labLevel = scopes
      .filter(scope => scope.laboratory_id === laboratoryId && scope.department_id == null)
      .map(scope => scope.permissions);
    if (labLevel.length > 0) {
      return mergePermissions(labLevel);
    }
    const labAny = scopes
      .filter(scope => scope.laboratory_id === laboratoryId)
      .map(scope => scope.permissions);
    if (labAny.length === 0) {
      return null;
    }
    return mergePermissions(labAny);
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
