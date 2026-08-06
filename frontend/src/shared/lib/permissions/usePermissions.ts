import { useOutletContext } from 'react-router-dom';
import { defaultRolePermissions } from '../../config/permissions';
import { checkPermission } from './checkPermission';
import { resolvePermissionsForScope } from './roleScopes';
import type { UserPermissions } from '../../api/userRole';
import type { RolePermissions } from '../../config/permissions';

export interface PermissionsOutletContext {
  minimize?: boolean;
  isAdmin: boolean;
  permissionsData: UserPermissions;
}

export function usePermissionsContext(): PermissionsOutletContext {
  return (
    useOutletContext<PermissionsOutletContext>() || {
      isAdmin: false,
      permissionsData: {
        access_granted: false,
        is_admin: false,
        role_names: [],
        role_types: [],
        scopes: [],
        permissions: defaultRolePermissions(),
        visibility_scope: { laboratory_ids: [], department_ids: [] },
      },
    }
  );
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
