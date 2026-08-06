import { defaultRolePermissions, syncCrudReadFromNavigation } from '../config/permissions';
import { scopeBindingKey } from './permissions';
import type { Department, Laboratory } from '../api/laboratories';
import type { RoleScopeBinding } from '../api/roles';
import type { VisibilityScope } from '../api/testObjects';

export const VISIBILITY_LAB_PREFIX = 'laboratory:';
export const VISIBILITY_DEPT_PREFIX = 'department:';

export interface VisibilityScopeOption {
  value: string;
  label: string;
}

export interface LaboratoryWithDepartments {
  laboratory: Laboratory;
  departments: Department[];
}

export function buildVisibilityScopeOptions(
  labsWithDepartments: LaboratoryWithDepartments[]
): VisibilityScopeOption[] {
  const options: VisibilityScopeOption[] = [];

  labsWithDepartments.forEach(({ laboratory, departments }) => {
    const labLabel = laboratory.full_name || laboratory.name;

    if (departments.length === 0) {
      options.push({
        value: `${VISIBILITY_LAB_PREFIX}${laboratory.id}`,
        label: labLabel,
      });
      return;
    }

    departments.forEach(department => {
      options.push({
        value: `${VISIBILITY_DEPT_PREFIX}${department.id}`,
        label: `${labLabel} — ${department.name}`,
      });
    });
  });

  return options.sort((left, right) => left.label.localeCompare(right.label, 'ru'));
}

export function visibilityScopeToSelectValues(scope: VisibilityScope): string[] {
  const laboratoryIds = scope.laboratory_ids || [];
  const departmentIds = scope.department_ids || [];

  return [
    ...laboratoryIds.map(id => `${VISIBILITY_LAB_PREFIX}${id}`),
    ...departmentIds.map(id => `${VISIBILITY_DEPT_PREFIX}${id}`),
  ];
}

export function selectValuesToVisibilityScope(values: string[]): VisibilityScope {
  const laboratory_ids: number[] = [];
  const department_ids: number[] = [];

  values.forEach(rawValue => {
    if (rawValue.startsWith(VISIBILITY_LAB_PREFIX)) {
      const id = Number.parseInt(rawValue.slice(VISIBILITY_LAB_PREFIX.length), 10);
      if (!Number.isNaN(id) && id > 0) {
        laboratory_ids.push(id);
      }
      return;
    }

    if (rawValue.startsWith(VISIBILITY_DEPT_PREFIX)) {
      const id = Number.parseInt(rawValue.slice(VISIBILITY_DEPT_PREFIX.length), 10);
      if (!Number.isNaN(id) && id > 0) {
        department_ids.push(id);
      }
    }
  });

  return { laboratory_ids, department_ids };
}

export function roleScopesToSelectValues(scopes: RoleScopeBinding[]): string[] {
  return scopes.map(scope => scopeBindingKey(scope));
}

export function selectValuesToRoleScopes(
  values: string[],
  labsWithDepartments: LaboratoryWithDepartments[],
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
    if (rawValue.startsWith(VISIBILITY_LAB_PREFIX)) {
      const laboratoryId = Number.parseInt(rawValue.slice(VISIBILITY_LAB_PREFIX.length), 10);
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

    if (rawValue.startsWith(VISIBILITY_DEPT_PREFIX)) {
      const departmentId = Number.parseInt(rawValue.slice(VISIBILITY_DEPT_PREFIX.length), 10);
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

export function formatVisibilityScopeDisplay(
  scope: VisibilityScope,
  labsWithDepartments: LaboratoryWithDepartments[]
): string {
  const laboratoryIds = scope.laboratory_ids || [];
  const departmentIds = scope.department_ids || [];

  if (laboratoryIds.length === 0 && departmentIds.length === 0) {
    return 'Нет доступа';
  }

  const labels: string[] = [];

  laboratoryIds.forEach(labId => {
    const entry = labsWithDepartments.find(item => item.laboratory.id === labId);
    if (entry) {
      labels.push(entry.laboratory.full_name || entry.laboratory.name);
    } else {
      labels.push(`Лаборатория #${labId}`);
    }
  });

  departmentIds.forEach(deptId => {
    for (const entry of labsWithDepartments) {
      const department = entry.departments.find(item => item.id === deptId);
      if (department) {
        const labLabel = entry.laboratory.full_name || entry.laboratory.name;
        labels.push(`${labLabel} — ${department.name}`);
        return;
      }
    }
    labels.push(`Подразделение #${deptId}`);
  });

  return labels.join('; ');
}
