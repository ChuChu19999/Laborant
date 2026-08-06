import { useOutletContext } from 'react-router-dom';
import { defaultRolePermissions } from '../../config/permissions';
import { resolvePermissionsForScope } from './roleScopes';
import type { UserPermissions } from '../../api/userRole';
import type { CrudPermissions, RolePermissions } from '../../config/permissions';

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

function checkPermission(
  permissions: RolePermissions,
  resource: keyof RolePermissions | 'laboratory_management',
  action?: string
): boolean {
  if (resource === 'laboratory_management') {
    return Boolean(permissions.laboratory_management.access);
  }

  if (resource === 'navigation' && action) {
    return Boolean(permissions.navigation[action as keyof typeof permissions.navigation]);
  }

  if (resource === 'samples' && action) {
    if (action === 'update' || action === 'delete') {
      return Boolean(permissions.samples[action]);
    }
    if (action === 'visible_fields') {
      return true;
    }
    return permissions.samples.visible_fields.includes(action);
  }

  if (resource === 'calculations' && action) {
    return Boolean(permissions.calculations[action as keyof typeof permissions.calculations]);
  }

  if (resource === 'sampling_terminology') {
    return true;
  }

  const section = permissions[resource as keyof RolePermissions];
  if (section && typeof section === 'object' && action && 'read' in section) {
    const navKey = resource as keyof typeof permissions.navigation;
    const hasNav = navKey in permissions.navigation && Boolean(permissions.navigation[navKey]);
    if (!hasNav) {
      return false;
    }
    if (action === 'read') {
      return true;
    }
    return Boolean((section as CrudPermissions)[action as keyof CrudPermissions]);
  }

  return false;
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
