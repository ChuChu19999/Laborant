import { axiosInstance } from '../config/axios';
import type { PaginatedResponse } from './types';

export interface LaboratoryResponse {
  id: number;
  name: string;
  full_name?: string;
  laboratory_location?: string;
  departments_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DepartmentResponse {
  id: number;
  name: string;
  laboratory_id: number;
  laboratory_location: string;
  laboratory_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BranchResponse {
  id: number;
  name: string;
  phone?: string;
  laboratory_id?: number;
  department_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SamplingLocationResponse {
  id: number;
  name: string;
  branch_id: number;
  branch_name?: string;
  branch_phone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LaboratoryCreate {
  name: string;
  full_name?: string;
  laboratory_location?: string;
}

export interface LaboratoryUpdate {
  name?: string;
  full_name?: string;
  laboratory_location?: string;
}

export interface DepartmentCreate {
  name: string;
  laboratory_id: number;
  laboratory_location: string;
}

export interface DepartmentUpdate {
  name?: string;
  laboratory_id?: number;
  laboratory_location?: string;
}

export interface BranchCreate {
  name: string;
  phone?: string;
  laboratory_id?: number;
  department_id?: number;
}

export interface BranchUpdate {
  name?: string;
  phone?: string;
  laboratory_id?: number;
  department_id?: number;
}

export interface SamplingLocationCreate {
  name: string;
  branch_id: number;
}

export interface SamplingLocationUpdate {
  name?: string;
  branch_id?: number;
}

export const laboratoryApi = {
  // Лаборатории
  listLaboratories: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const response = await axiosInstance.get<PaginatedResponse<LaboratoryResponse>>(
      '/api/laboratories/',
      { params }
    );
    return response.data;
  },

  getLaboratory: async (id: number) => {
    const response = await axiosInstance.get<LaboratoryResponse>(`/api/laboratories/${id}/`);
    return response.data;
  },

  createLaboratory: async (data: LaboratoryCreate) => {
    const response = await axiosInstance.post<LaboratoryResponse>('/api/laboratories/', data);
    return response.data;
  },

  updateLaboratory: async (id: number, data: LaboratoryUpdate) => {
    const response = await axiosInstance.patch<LaboratoryResponse>(
      `/api/laboratories/${id}/`,
      data
    );
    return response.data;
  },

  deleteLaboratory: async (id: number) => {
    await axiosInstance.delete(`/api/laboratories/${id}/`);
  },

  // Подразделения
  listDepartments: async (params?: {
    laboratory_id?: number;
    page?: number;
    page_size?: number;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const response = await axiosInstance.get<PaginatedResponse<DepartmentResponse>>(
      '/api/departments/',
      { params }
    );
    return response.data;
  },

  getDepartmentsByLaboratory: async (laboratory_id: number) => {
    const response = await axiosInstance.get<DepartmentResponse[]>(
      '/api/departments/by-laboratory/',
      { params: { laboratory_id } }
    );
    return response.data;
  },

  getDepartment: async (id: number) => {
    const response = await axiosInstance.get<DepartmentResponse>(`/api/departments/${id}/`);
    return response.data;
  },

  createDepartment: async (data: DepartmentCreate) => {
    const response = await axiosInstance.post<DepartmentResponse>('/api/departments/', data);
    return response.data;
  },

  updateDepartment: async (id: number, data: DepartmentUpdate) => {
    const response = await axiosInstance.patch<DepartmentResponse>(`/api/departments/${id}/`, data);
    return response.data;
  },

  deleteDepartment: async (id: number) => {
    await axiosInstance.delete(`/api/departments/${id}/`);
  },

  // Филиалы
  listBranches: async (params?: {
    laboratory_id?: number;
    department_id?: number;
    page?: number;
    page_size?: number;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const response = await axiosInstance.get<PaginatedResponse<BranchResponse>>('/api/branches/', {
      params,
    });
    return response.data;
  },

  getBranch: async (id: number) => {
    const response = await axiosInstance.get<BranchResponse>(`/api/branches/${id}/`);
    return response.data;
  },

  createBranch: async (data: BranchCreate) => {
    const response = await axiosInstance.post<BranchResponse>('/api/branches/', data);
    return response.data;
  },

  updateBranch: async (id: number, data: BranchUpdate) => {
    const response = await axiosInstance.patch<BranchResponse>(`/api/branches/${id}/`, data);
    return response.data;
  },

  deleteBranch: async (id: number) => {
    await axiosInstance.delete(`/api/branches/${id}/`);
  },

  // Места отбора проб
  listSamplingLocations: async (params?: {
    branch_id?: number;
    page?: number;
    page_size?: number;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const response = await axiosInstance.get<PaginatedResponse<SamplingLocationResponse>>(
      '/api/sampling-locations/',
      { params }
    );
    return response.data;
  },

  getSamplingLocation: async (id: number) => {
    const response = await axiosInstance.get<SamplingLocationResponse>(
      `/api/sampling-locations/${id}/`
    );
    return response.data;
  },

  createSamplingLocation: async (data: SamplingLocationCreate) => {
    const response = await axiosInstance.post<SamplingLocationResponse>(
      '/api/sampling-locations/',
      data
    );
    return response.data;
  },

  updateSamplingLocation: async (id: number, data: SamplingLocationUpdate) => {
    const response = await axiosInstance.patch<SamplingLocationResponse>(
      `/api/sampling-locations/${id}/`,
      data
    );
    return response.data;
  },

  deleteSamplingLocation: async (id: number) => {
    await axiosInstance.delete(`/api/sampling-locations/${id}/`);
  },
};
