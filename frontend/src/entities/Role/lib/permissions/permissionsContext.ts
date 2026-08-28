import { createContext } from 'react';
import { defaultRolePermissions } from '../permissionsConfig';
import type { UserPermissions } from '../../api/permissionTypes';

export interface PermissionsContextValue {
  isAdmin: boolean;
  permissionsData: UserPermissions;
}

export const fallbackPermissions: PermissionsContextValue = {
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
};

export const PermissionsContext = createContext<PermissionsContextValue>(fallbackPermissions);
