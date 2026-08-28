import { useCallback } from 'react';
import { checkPermission } from './checkPermission';
import {
  canAccessDepartmentFromScopes,
  canAccessLaboratoryFromScopes,
  resolvePermissionsForScope,
} from './roleScopes';
import { usePermissionsContext } from './usePermissions';
import type { RoleScopeBinding } from '../../api/permissionTypes';
import type { RolePermissions } from '../permissionsConfig';

const EMPTY_SCOPES: RoleScopeBinding[] = [];

/** Проверки доступа к лабораториям/подразделениям и к фиче в их контексте. */
export function useScopeAccess() {
  const { isAdmin, permissionsData } = usePermissionsContext();
  const unrestricted = isAdmin || permissionsData.is_admin;
  const scopes = permissionsData.scopes ?? EMPTY_SCOPES;

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

  /** Есть ли привязка к lab/dept из URL. */
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

  /** Право на фичу в контексте лаборатории/подразделения (как enforce_* на бэкенде). */
  const canAccessFeature = useCallback(
    (
      resource: keyof RolePermissions | 'laboratory_management',
      action?: string,
      laboratoryId?: number | null,
      departmentId?: number | null
    ) => {
      if (unrestricted) {
        return true;
      }
      if (!permissionsData.access_granted) {
        return false;
      }
      if (laboratoryId != null || departmentId != null) {
        const scoped = resolvePermissionsForScope(scopes, laboratoryId, departmentId);
        if (!scoped) {
          return false;
        }
        return checkPermission(scoped, resource, action);
      }
      return checkPermission(permissionsData.permissions, resource, action);
    },
    [unrestricted, permissionsData.access_granted, permissionsData.permissions, scopes]
  );

  /**
   * Гард URL: без lab — пускаем (список лабораторий);
   * с lab/dept — нужна фича в этой привязке.
   */
  const canAccessFeatureRoute = useCallback(
    (
      resource: keyof RolePermissions | 'laboratory_management',
      action: string | undefined,
      laboratoryId?: number,
      departmentId?: number
    ) => {
      if (laboratoryId == null) {
        return true;
      }
      return canAccessFeature(resource, action, laboratoryId, departmentId);
    },
    [canAccessFeature]
  );

  return {
    canAccessLaboratory,
    canAccessDepartment,
    canAccessRouteScope,
    canAccessFeature,
    canAccessFeatureRoute,
    unrestricted,
  };
}
