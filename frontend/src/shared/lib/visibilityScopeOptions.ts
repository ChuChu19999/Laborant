import type { Department, Laboratory } from '../api/laboratories';
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

export function formatVisibilityScopeDisplay(
  scope: VisibilityScope,
  labsWithDepartments: LaboratoryWithDepartments[]
): string {
  const laboratoryIds = scope.laboratory_ids || [];
  const departmentIds = scope.department_ids || [];

  if (laboratoryIds.length === 0 && departmentIds.length === 0) {
    return 'Все лаборатории и подразделения';
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
