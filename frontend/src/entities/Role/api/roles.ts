import { axiosInstance } from '@/shared/config';
import type { RoleScopeBinding } from './permissionTypes';
import type { RoleFilters, RoleTypeValue } from '../lib/roleTypeOptions';
import type { PaginatedResponse } from '@/shared/lib/http';

export type { RoleFilters, RoleTypeValue } from '../lib/roleTypeOptions';
export type { RoleScopeBinding } from './permissionTypes';

export interface RoleCatalogItem {
  id: number;
  name: string;
  role_type: RoleTypeValue;
  scopes: RoleScopeBinding[];
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/** Данные для создания роли. */
export interface RoleCreate {
  name: string;
  role_type: RoleTypeValue;
  scopes?: RoleScopeBinding[];
}

/** Данные для обновления роли. */
export interface RoleUpdate {
  name?: string;
  role_type?: RoleTypeValue;
  scopes?: RoleScopeBinding[];
}

/** API ролей. */
export const rolesApi = {
  getRoles: async (
    page?: number,
    pageSize?: number,
    filters?: RoleFilters,
    sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' }
  ): Promise<PaginatedResponse<RoleCatalogItem>> => {
    const params: Record<string, unknown> = {};

    if (page !== undefined) {
      params.page = page;
    }

    if (pageSize !== undefined) {
      params.page_size = pageSize;
    }

    if (filters?.search) {
      params.search = filters.search;
    }

    if (filters?.role_type) {
      params.role_type = filters.role_type;
    }

    if (sorting?.sort_by) {
      params.sort_by = sorting.sort_by;
      params.sort_order = sorting.sort_order || 'asc';
    }

    const response = await axiosInstance.get<PaginatedResponse<RoleCatalogItem>>('/api/roles/', {
      params,
    });
    return response.data;
  },

  getRoleById: async (id: number): Promise<RoleCatalogItem> => {
    const response = await axiosInstance.get<RoleCatalogItem>(`/api/roles/${id}/`);
    return response.data;
  },

  createRole: async (data: RoleCreate): Promise<RoleCatalogItem> => {
    const response = await axiosInstance.post<RoleCatalogItem>('/api/roles/', data);
    return response.data;
  },

  updateRole: async (id: number, data: RoleUpdate): Promise<RoleCatalogItem> => {
    const response = await axiosInstance.patch<RoleCatalogItem>(`/api/roles/${id}/`, data);
    return response.data;
  },

  deleteRole: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/roles/${id}/`);
  },
};
