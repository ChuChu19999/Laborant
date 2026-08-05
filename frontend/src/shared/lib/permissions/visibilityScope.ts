import type { VisibilityScope } from '../../api/testObjects';

/** Пустой scope = доступ ко всем лабораториям и подразделениям. */
export function isScopeUnrestricted(
  scope: Pick<VisibilityScope, 'laboratory_ids' | 'department_ids'> | null | undefined
): boolean {
  if (!scope) {
    return true;
  }
  return (scope.laboratory_ids?.length || 0) === 0 && (scope.department_ids?.length || 0) === 0;
}

/**
 * Доступ к лаборатории/подразделению по visibility_scope (как на бэкенде).
 * Пустой scope — везде; department_ids — конкретные подразделения; laboratory_ids — вся лаборатория.
 */
export function isVisibleInScope(
  scope: Pick<VisibilityScope, 'laboratory_ids' | 'department_ids'> | null | undefined,
  laboratoryId?: number | null,
  departmentId?: number | null
): boolean {
  if (isScopeUnrestricted(scope)) {
    return true;
  }

  const laboratoryIds = scope?.laboratory_ids || [];
  const departmentIds = scope?.department_ids || [];

  if (departmentId != null && departmentIds.includes(departmentId)) {
    return true;
  }

  if (laboratoryId != null && laboratoryIds.includes(laboratoryId)) {
    return true;
  }

  return false;
}

/**
 * Карточка лаборатории кликабельна, если лаборатория в scope
 * или в scope есть подразделения.
 */
export function isLaboratoryCardAccessible(
  scope: Pick<VisibilityScope, 'laboratory_ids' | 'department_ids'> | null | undefined,
  laboratoryId: number
): boolean {
  if (isScopeUnrestricted(scope)) {
    return true;
  }

  const laboratoryIds = scope?.laboratory_ids || [];
  const departmentIds = scope?.department_ids || [];

  if (laboratoryIds.includes(laboratoryId)) {
    return true;
  }

  return departmentIds.length > 0;
}
