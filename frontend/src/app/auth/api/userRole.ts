import { axiosInstance } from '@/shared/config';
import type { UserPermissions } from '@/entities/Role';

export type { UserPermissions } from '@/entities/Role';

export const userRoleApi = {
  getMyPermissions: async (): Promise<UserPermissions> => {
    const response = await axiosInstance.get<UserPermissions>('/api/user-roles/me/');
    return response.data;
  },
};
