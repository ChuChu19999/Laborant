import type { VisibilityScope } from '@/entities/Role/@x/Laboratory';

export const VISIBILITY_LAB_PREFIX = 'laboratory:';
export const VISIBILITY_DEPT_PREFIX = 'department:';

export interface VisibilityScopeOption {
  value: string;
  label: string;
}

export interface LaboratoryWithDepartments {
  laboratory: { id: number; name: string; full_name?: string };
  departments: { id: number; name: string }[];
}

/** Строит опции Select для областей видимости лабораторий и подразделений. */
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

/** Преобразует область видимости в значения Select. */
export function visibilityScopeToSelectValues(scope: VisibilityScope): string[] {
  const laboratoryIds = scope.laboratory_ids || [];
  const departmentIds = scope.department_ids || [];

  return [
    ...laboratoryIds.map(id => `${VISIBILITY_LAB_PREFIX}${id}`),
    ...departmentIds.map(id => `${VISIBILITY_DEPT_PREFIX}${id}`),
  ];
}

/** Преобразует значения Select в область видимости. */
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
