import { axiosInstance } from '../config/axios';
import type { PaginatedResponse } from './types';

export interface ResearchMethodResponse {
  id: number;
  name: string;
  sample_type: string[];
  formula: string;
  measurement_error: Record<string, unknown>;
  unit: string;
  measurement_method: string;
  nd_code: string;
  nd_name: string;
  input_data: Record<string, unknown>;
  intermediate_data: Record<string, unknown>;
  convergence_conditions: Record<string, unknown>;
  rounding_type: string;
  rounding_decimal: number;
  is_group_member: boolean;
  equipment_data_default?: number[];
  sort_order?: number;
  laboratory_id?: number;
  department_id?: number;
  groups?: Array<{ id: number; name: string }>;
  created_at?: string;
  updated_at?: string;
}

export interface ResearchMethodGroupResponse {
  id: number;
  name: string;
  laboratory_id?: number;
  department_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ResearchMethodCreate {
  name: string;
  sample_type: string[];
  formula: string;
  measurement_error: Record<string, unknown>;
  unit: string;
  measurement_method: string;
  nd_code: string;
  nd_name: string;
  input_data: Record<string, unknown>;
  intermediate_data: Record<string, unknown>;
  convergence_conditions?: Record<string, unknown>;
  rounding_type: string;
  rounding_decimal: number;
  is_group_member?: boolean;
  equipment_data_default?: number[];
  sort_order?: number;
  laboratory_id?: number;
  department_id?: number;
}

export interface ResearchMethodUpdate {
  name?: string;
  sample_type?: string[];
  formula?: string;
  measurement_error?: Record<string, unknown>;
  unit?: string;
  measurement_method?: string;
  nd_code?: string;
  nd_name?: string;
  input_data?: Record<string, unknown>;
  intermediate_data?: Record<string, unknown>;
  convergence_conditions?: Record<string, unknown>;
  rounding_type?: string;
  rounding_decimal?: number;
  is_group_member?: boolean;
  equipment_data_default?: number[];
  sort_order?: number;
  laboratory_id?: number;
  department_id?: number;
}

export interface ResearchMethodGroupCreate {
  name: string;
  method_ids: number[];
  laboratory_id?: number;
  department_id?: number;
}

export interface ResearchMethodGroupUpdate {
  name?: string;
  laboratory_id?: number;
  department_id?: number;
}

export interface ResearchMethodSortOrderUpdate {
  sort_order: number;
}

export const researchApi = {
  listResearchMethods: async (params?: {
    laboratory_id?: number;
    department_id?: number;
    page?: number;
    page_size?: number;
    search?: string;
    rounding_type?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const response = await axiosInstance.get<PaginatedResponse<ResearchMethodResponse>>(
      '/api/research-methods/',
      { params }
    );
    return response.data;
  },

  getResearchMethod: async (id: number) => {
    const response = await axiosInstance.get<ResearchMethodResponse>(
      `/api/research-methods/${id}/`
    );
    return response.data;
  },

  createResearchMethod: async (data: ResearchMethodCreate) => {
    const response = await axiosInstance.post<ResearchMethodResponse>(
      '/api/research-methods/',
      data
    );
    return response.data;
  },

  updateResearchMethod: async (id: number, data: ResearchMethodUpdate) => {
    const response = await axiosInstance.patch<ResearchMethodResponse>(
      `/api/research-methods/${id}/`,
      data
    );
    return response.data;
  },

  deleteResearchMethod: async (id: number) => {
    await axiosInstance.delete(`/api/research-methods/${id}/`);
  },

  updateResearchMethodSortOrder: async (id: number, data: ResearchMethodSortOrderUpdate) => {
    const response = await axiosInstance.patch<ResearchMethodResponse>(
      `/api/research-methods/${id}/sort-order/`,
      data
    );
    return response.data;
  },

  listResearchMethodGroups: async (params?: {
    laboratory_id?: number;
    department_id?: number;
    page?: number;
    page_size?: number;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const response = await axiosInstance.get<PaginatedResponse<ResearchMethodGroupResponse>>(
      '/api/research-method-groups/',
      { params }
    );
    return response.data;
  },

  getResearchMethodGroup: async (id: number) => {
    const response = await axiosInstance.get<ResearchMethodGroupResponse>(
      `/api/research-method-groups/${id}/`
    );
    return response.data;
  },

  createResearchMethodGroup: async (data: ResearchMethodGroupCreate) => {
    const response = await axiosInstance.post<ResearchMethodGroupResponse>(
      '/api/research-method-groups/',
      data
    );
    return response.data;
  },

  updateResearchMethodGroup: async (id: number, data: ResearchMethodGroupUpdate) => {
    const response = await axiosInstance.patch<ResearchMethodGroupResponse>(
      `/api/research-method-groups/${id}/`,
      data
    );
    return response.data;
  },

  deleteResearchMethodGroup: async (id: number) => {
    await axiosInstance.delete(`/api/research-method-groups/${id}/`);
  },

  getAvailableMethods: async (params: {
    laboratory_id: number;
    department_id?: number;
    sample_id?: number;
  }) => {
    const response = await axiosInstance.get('/api/research-methods/available/', { params });
    return response.data;
  },
};
