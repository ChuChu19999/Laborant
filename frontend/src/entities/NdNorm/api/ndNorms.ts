import { axiosInstance } from '@/shared/config';
import type { PaginatedResponse } from '@/shared/lib/http';

export interface NdNormMethodDataItem {
  method_id: number;
  value: string;
}

export interface NdNorm {
  id: number;
  name: string;
  test_object: string;
  laboratory_id: number;
  department_id?: number;
  method_data: NdNormMethodDataItem[];
  laboratory_name?: string;
  department_name?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/** Данные для создания нормы НД. */
export interface NdNormCreate {
  name: string;
  test_object: string;
  laboratory_id: number;
  department_id?: number;
  method_data: NdNormMethodDataItem[];
}

/** Данные для обновления нормы НД. */
export interface NdNormUpdate {
  name?: string;
  test_object?: string;
  laboratory_id?: number;
  department_id?: number;
  method_data?: NdNormMethodDataItem[];
}

/** Фильтры списка норм НД. */
export interface NdNormFilters {
  name?: string;
  test_object?: string;
  test_objects?: string[];
  created_at_from?: string;
  created_at_to?: string;
  [key: string]: unknown;
}

/** API норм НД. */
export const ndNormsApi = {
  getNdNorms: async (
    page?: number,
    pageSize?: number,
    filters?: NdNormFilters,
    sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' },
    laboratoryId?: number,
    departmentId?: number
  ): Promise<PaginatedResponse<NdNorm>> => {
    const params: Record<string, unknown> = {};

    if (page !== undefined) {
      params.page = page;
    }

    if (pageSize !== undefined) {
      params.page_size = pageSize;
    }

    if (laboratoryId) {
      params.laboratory_id = laboratoryId;
    }

    if (departmentId) {
      params.department_id = departmentId;
    }

    if (filters?.name) {
      params.search = filters.name;
    }

    if (filters?.test_objects && filters.test_objects.length > 0) {
      params.test_objects = filters.test_objects;
    } else if (filters?.test_object) {
      params.test_object = filters.test_object;
    }

    if (filters?.created_at_from) {
      params.created_at_from = filters.created_at_from;
    }
    if (filters?.created_at_to) {
      params.created_at_to = filters.created_at_to;
    }

    if (sorting?.sort_by) {
      params.sort_by = sorting.sort_by;
      params.sort_order = sorting.sort_order || 'desc';
    }

    const response = await axiosInstance.get<PaginatedResponse<NdNorm>>('/api/nd-norms/', {
      params,
    });
    return response.data;
  },

  getNdNormById: async (id: number): Promise<NdNorm> => {
    const response = await axiosInstance.get<NdNorm>(`/api/nd-norms/${id}/`);
    return response.data;
  },

  createNdNorm: async (data: NdNormCreate): Promise<NdNorm> => {
    const response = await axiosInstance.post<NdNorm>('/api/nd-norms/', data);
    return response.data;
  },

  updateNdNorm: async (id: number, data: NdNormUpdate): Promise<NdNorm> => {
    const response = await axiosInstance.patch<NdNorm>(`/api/nd-norms/${id}/`, data);
    return response.data;
  },

  deleteNdNorm: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/nd-norms/${id}/`);
  },
};
