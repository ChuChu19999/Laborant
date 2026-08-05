import { axiosInstance } from '../config/axios';
import type { VisibilityScope } from './testObjects';
import type { RolePermissions } from '../config/permissions';

export interface UserPermissions {
  access_granted: boolean;
  is_admin: boolean;
  role_names: string[];
  role_types: string[];
  permissions: RolePermissions;
  visibility_scope: VisibilityScope;
}

export const userRoleKeys = {
  all: ['user-roles'] as const,
  me: () => [...userRoleKeys.all, 'me'] as const,
};

export const userRoleApi = {
  getMyPermissions: async (): Promise<UserPermissions> => {
    const response = await axiosInstance.get<UserPermissions>('/api/user-roles/me/');
    return response.data;
  },
};
