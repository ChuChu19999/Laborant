import { useContext } from 'react';
import { checkPermission } from './checkPermission';
import { PermissionsContext, type PermissionsContextValue } from './permissionsContext';
import { resolvePermissionsForScope } from './roleScopes';
import type { RolePermissions } from '../permissionsConfig';

export function usePermissionsContext(): PermissionsContextValue {
  return useContext(PermissionsContext);
}

export function useCan(
  resource: keyof RolePermissions | 'laboratory_management',
  action?: string,
  laboratoryId?: number | null,
  departmentId?: number | null
): boolean {
  const { isAdmin, permissionsData } = usePermissionsContext();
  if (isAdmin || permissionsData.is_admin) {
    return true;
  }
  if (!permissionsData.access_granted) {
    return false;
  }

  if (laboratoryId != null || departmentId != null) {
    const scoped = resolvePermissionsForScope(permissionsData.scopes, laboratoryId, departmentId);
    if (!scoped) {
      return false;
    }
    return checkPermission(scoped, resource, action);
  }

  return checkPermission(permissionsData.permissions, resource, action);
}
