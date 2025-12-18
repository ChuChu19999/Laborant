import { axiosInstance } from '../config/axios';
import type { PaginatedResponse } from './laboratories';

export interface Branch {
  id: number;
  name: string;
  phone?: string;
  laboratory_id: number;
  department_id?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface SamplingLocation {
  id: number;
  name: string;
  branch_id: number;
  branch_name?: string;
  branch_phone?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface BranchCreate {
  name: string;
  phone?: string;
  laboratory_id: number;
  department_id?: number;
}

export interface BranchUpdate {
  name?: string;
  phone?: string;
}

export interface SamplingLocationCreate {
  name: string;
  branch_id: number;
}

export interface SamplingLocationUpdate {
  name?: string;
  branch_id?: number;
}

export const samplingLocationsApi = {
  getBranches: async (
    laboratoryId?: number,
    departmentId?: number,
    params?: {
      page?: number;
      page_size?: number;
      search?: string;
      sort_by?: string;
      sort_order?: string;
    }
  ): Promise<PaginatedResponse<Branch>> => {
    const queryParams: Record<string, unknown> = {
      ...params,
    };

    if (laboratoryId) {
      queryParams.laboratory_id = laboratoryId;
    }

    if (departmentId) {
      queryParams.department_id = departmentId;
    }

    const response = await axiosInstance.get<PaginatedResponse<Branch>>('/api/branches/', {
      params: queryParams,
    });
    return response.data;
  },

  getBranch: async (id: number): Promise<Branch> => {
    const response = await axiosInstance.get<Branch>(`/api/branches/${id}/`);
    return response.data;
  },

  createBranch: async (data: BranchCreate): Promise<Branch> => {
    const response = await axiosInstance.post<Branch>('/api/branches/', data);
    return response.data;
  },

  updateBranch: async (id: number, data: BranchUpdate): Promise<Branch> => {
    const response = await axiosInstance.patch<Branch>(`/api/branches/${id}/`, data);
    return response.data;
  },

  deleteBranch: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/branches/${id}/`);
  },

  getSamplingLocations: async (
    branchId?: number,
    params?: {
      page?: number;
      page_size?: number;
      search?: string;
      sort_by?: string;
      sort_order?: string;
    }
  ): Promise<PaginatedResponse<SamplingLocation>> => {
    const queryParams: Record<string, unknown> = {
      ...params,
    };

    if (branchId) {
      queryParams.branch_id = branchId;
    }

    const response = await axiosInstance.get<PaginatedResponse<SamplingLocation>>(
      '/api/laboratories/sampling-locations/',
      {
        params: queryParams,
      }
    );
    return response.data;
  },

  getSamplingLocation: async (id: number): Promise<SamplingLocation> => {
    const response = await axiosInstance.get<SamplingLocation>(
      `/api/laboratories/sampling-locations/${id}/`
    );
    return response.data;
  },

  createSamplingLocation: async (data: SamplingLocationCreate): Promise<SamplingLocation> => {
    const response = await axiosInstance.post<SamplingLocation>(
      '/api/laboratories/sampling-locations/',
      data
    );
    return response.data;
  },

  updateSamplingLocation: async (
    id: number,
    data: SamplingLocationUpdate
  ): Promise<SamplingLocation> => {
    const response = await axiosInstance.patch<SamplingLocation>(
      `/api/laboratories/sampling-locations/${id}/`,
      data
    );
    return response.data;
  },

  deleteSamplingLocation: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/laboratories/sampling-locations/${id}/`);
  },
};
