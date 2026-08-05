import { useCallback } from 'react';
import { usePermissionsContext } from './usePermissions';
import {
  isLaboratoryCardAccessible,
  isScopeUnrestricted,
  isVisibleInScope,
} from './visibilityScope';

/** Проверки доступа к карточкам лабораторий и подразделений по visibility_scope. */
export function useScopeAccess() {
  const { isAdmin, permissionsData } = usePermissionsContext();
  const unrestricted =
    isAdmin || permissionsData.is_admin || isScopeUnrestricted(permissionsData.visibility_scope);
  const scope = permissionsData.visibility_scope;

  const canAccessLaboratory = useCallback(
    (laboratoryId: number) => {
      if (unrestricted) {
        return true;
      }
      return isLaboratoryCardAccessible(scope, laboratoryId);
    },
    [unrestricted, scope]
  );

  const canAccessDepartment = useCallback(
    (laboratoryId: number, departmentId: number) => {
      if (unrestricted) {
        return true;
      }
      return isVisibleInScope(scope, laboratoryId, departmentId);
    },
    [unrestricted, scope]
  );

  /** Проверка lab/dept из URL: нет доступа → показывать 403. */
  const canAccessRouteScope = useCallback(
    (laboratoryId?: number, departmentId?: number) => {
      if (laboratoryId == null) {
        return true;
      }
      if (departmentId != null) {
        return canAccessDepartment(laboratoryId, departmentId);
      }
      return canAccessLaboratory(laboratoryId);
    },
    [canAccessLaboratory, canAccessDepartment]
  );

  return {
    canAccessLaboratory,
    canAccessDepartment,
    canAccessRouteScope,
    unrestricted,
  };
}
