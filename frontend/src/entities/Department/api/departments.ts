import { axiosInstance } from '@/shared/config';
import type { PaginatedResponse } from '@/shared/lib/http';

export interface Department {
  id: number;
  name: string;
  laboratory_id: number;
  laboratory_name?: string;
  laboratory_location: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/** Данные для создания подразделения. */
export interface DepartmentCreate {
  name: string;
  laboratory_id: number;
  laboratory_location: string;
}

/** Данные для обновления подразделения. */
export interface DepartmentUpdate {
  name?: string;
  laboratory_location?: string;
}

/** API подразделений. */
export const departmentsApi = {
  getDepartments: async (params?: {
    laboratory_id?: number;
    page?: number;
    page_size?: number;
    search?: string;
    sort_by?: string;
    sort_order?: string;
  }): Promise<PaginatedResponse<Department>> => {
    const response = await axiosInstance.get<PaginatedResponse<Department>>('/api/departments/', {
      params,
    });
    return response.data;
  },

  getDepartmentsByLaboratory: async (laboratoryId: number): Promise<Department[]> => {
    const response = await axiosInstance.get<Department[]>('/api/departments/by-laboratory/', {
      params: { laboratory_id: laboratoryId },
    });
    return response.data;
  },

  getDepartment: async (id: number): Promise<Department> => {
    const response = await axiosInstance.get<Department>(`/api/departments/${id}/`);
    return response.data;
  },

  createDepartment: async (data: DepartmentCreate): Promise<Department> => {
    const response = await axiosInstance.post<Department>('/api/departments/', data);
    return response.data;
  },

  updateDepartment: async (id: number, data: DepartmentUpdate): Promise<Department> => {
    const response = await axiosInstance.patch<Department>(`/api/departments/${id}/`, data);
    return response.data;
  },

  deleteDepartment: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/departments/${id}/`);
  },
};
