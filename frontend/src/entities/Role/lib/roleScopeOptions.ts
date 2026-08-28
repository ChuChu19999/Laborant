import { scopeBindingKey } from './permissions';
import { defaultRolePermissions, syncCrudReadFromNavigation } from './permissionsConfig';
import type { RoleScopeBinding } from '../api/permissionTypes';

export const ROLE_SCOPE_LAB_PREFIX = 'laboratory:';
export const ROLE_SCOPE_DEPT_PREFIX = 'department:';

interface LabsWithDepartmentsForRoleScopes {
  laboratory: { id: number; name: string; full_name?: string };
  departments: { id: number; name: string }[];
}

/** Преобразует привязки областей роли в значения Select. */
export function roleScopesToSelectValues(scopes: RoleScopeBinding[]): string[] {
  return scopes.map(scope => scopeBindingKey(scope));
}

/** Преобразует значения Select в привязки областей роли с сохранением прав. */
export function selectValuesToRoleScopes(
  values: string[],
  labsWithDepartments: LabsWithDepartmentsForRoleScopes[],
  previousScopes: RoleScopeBinding[] = []
): RoleScopeBinding[] {
  const previousByKey = new Map(
    previousScopes.map(scope => [scopeBindingKey(scope), scope] as const)
  );
  const departmentLabMap = new Map<
    number,
    { laboratoryId: number; labName: string; deptName: string }
  >();

  labsWithDepartments.forEach(({ laboratory, departments }) => {
    const labLabel = laboratory.full_name || laboratory.name;
    departments.forEach(department => {
      departmentLabMap.set(department.id, {
        laboratoryId: laboratory.id,
        labName: labLabel,
        deptName: `${labLabel} — ${department.name}`,
      });
    });
  });

  const result: RoleScopeBinding[] = [];

  values.forEach(rawValue => {
    if (rawValue.startsWith(ROLE_SCOPE_LAB_PREFIX)) {
      const laboratoryId = Number.parseInt(rawValue.slice(ROLE_SCOPE_LAB_PREFIX.length), 10);
      if (Number.isNaN(laboratoryId) || laboratoryId <= 0) {
        return;
      }
      const previous = previousByKey.get(rawValue);
      const labEntry = labsWithDepartments.find(item => item.laboratory.id === laboratoryId);
      result.push({
        laboratory_id: laboratoryId,
        department_id: null,
        permissions: previous
          ? syncCrudReadFromNavigation(previous.permissions)
          : syncCrudReadFromNavigation(defaultRolePermissions()),
        laboratory_name:
          previous?.laboratory_name ||
          labEntry?.laboratory.full_name ||
          labEntry?.laboratory.name ||
          null,
        department_name: null,
      });
      return;
    }

    if (rawValue.startsWith(ROLE_SCOPE_DEPT_PREFIX)) {
      const departmentId = Number.parseInt(rawValue.slice(ROLE_SCOPE_DEPT_PREFIX.length), 10);
      if (Number.isNaN(departmentId) || departmentId <= 0) {
        return;
      }
      const mapping = departmentLabMap.get(departmentId);
      if (!mapping) {
        const previous = previousByKey.get(rawValue);
        if (!previous) {
          return;
        }
        result.push(previous);
        return;
      }
      const previous = previousByKey.get(rawValue);
      result.push({
        laboratory_id: mapping.laboratoryId,
        department_id: departmentId,
        permissions: previous
          ? syncCrudReadFromNavigation(previous.permissions)
          : syncCrudReadFromNavigation(defaultRolePermissions()),
        laboratory_name: previous?.laboratory_name || mapping.labName,
        department_name: previous?.department_name || mapping.deptName,
      });
    }
  });

  return result;
}

/** Формирует подпись области видимости роли для отображения. */
export function formatRoleScopeLabel(scope: RoleScopeBinding): string {
  if (scope.department_name) {
    return scope.department_name;
  }
  if (scope.laboratory_name) {
    return scope.laboratory_name;
  }
  if (scope.department_id != null) {
    return `Подразделение #${scope.department_id}`;
  }
  return `Лаборатория #${scope.laboratory_id}`;
}
