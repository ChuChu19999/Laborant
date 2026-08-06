import { useCallback, useMemo } from 'react';
import { canAccessDepartmentFromScopes, canAccessLaboratoryFromScopes } from './roleScopes';
import { usePermissionsContext } from './usePermissions';

/** Проверки доступа к карточкам лабораторий и подразделений по привязкам роли. */
export function useScopeAccess() {
  const { isAdmin, permissionsData } = usePermissionsContext();
  const unrestricted = isAdmin || permissionsData.is_admin;
  const scopes = useMemo(() => permissionsData.scopes || [], [permissionsData.scopes]);

  const canAccessLaboratory = useCallback(
    (laboratoryId: number) => {
      if (unrestricted) {
        return true;
      }
      return canAccessLaboratoryFromScopes(scopes, laboratoryId);
    },
    [unrestricted, scopes]
  );

  const canAccessDepartment = useCallback(
    (laboratoryId: number, departmentId: number) => {
      if (unrestricted) {
        return true;
      }
      return canAccessDepartmentFromScopes(scopes, laboratoryId, departmentId);
    },
    [unrestricted, scopes]
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
