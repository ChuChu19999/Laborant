import { axiosInstance } from '@/shared/config';
import type { PaginatedResponse } from '@/shared/lib/http';

export interface Laboratory {
  id: number;
  name: string;
  full_name: string;
  laboratory_location?: string;
  departments_count?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/** Данные для создания лаборатории. */
export interface LaboratoryCreate {
  name: string;
  full_name: string;
  laboratory_location?: string;
}

/** Данные для обновления лаборатории. */
export interface LaboratoryUpdate {
  name?: string;
  full_name?: string;
  laboratory_location?: string;
}

/** API лабораторий. */
export const laboratoriesApi = {
  getLaboratories: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    sort_by?: string;
    sort_order?: string;
  }): Promise<PaginatedResponse<Laboratory>> => {
    const response = await axiosInstance.get<PaginatedResponse<Laboratory>>('/api/laboratories/', {
      params,
    });
    return response.data;
  },

  getLaboratory: async (id: number): Promise<Laboratory> => {
    const response = await axiosInstance.get<Laboratory>(`/api/laboratories/${id}/`);
    return response.data;
  },

  createLaboratory: async (data: LaboratoryCreate): Promise<Laboratory> => {
    const response = await axiosInstance.post<Laboratory>('/api/laboratories/', data);
    return response.data;
  },

  updateLaboratory: async (id: number, data: LaboratoryUpdate): Promise<Laboratory> => {
    const response = await axiosInstance.patch<Laboratory>(`/api/laboratories/${id}/`, data);
    return response.data;
  },

  deleteLaboratory: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/laboratories/${id}/`);
  },
};
