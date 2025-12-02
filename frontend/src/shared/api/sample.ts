import { axiosInstance } from '../config/axios';
import type { PaginatedResponse } from './types';

export interface SampleResponse {
  id: number;
  registration_number: string;
  test_object: string;
  sampling_date?: string;
  receiving_date?: string;
  branch_id?: number;
  sampling_location_id?: number;
  well?: string;
  mode?: string;
  phone?: string;
  selection_conditions?: Record<string, unknown>;
  laboratory_id: number;
  department_id?: number;
  laboratory_name?: string;
  department_name?: string;
  branch_name?: string;
  sampling_location_name?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface SampleCreate {
  registration_number: string;
  test_object: string;
  sampling_date?: string;
  receiving_date?: string;
  branch_id?: number;
  sampling_location_id?: number;
  well?: string;
  mode?: string;
  phone?: string;
  selection_conditions?: Record<string, unknown>;
  laboratory_id: number;
  department_id?: number;
}

export interface SampleUpdate {
  registration_number?: string;
  test_object?: string;
  sampling_date?: string;
  receiving_date?: string;
  branch_id?: number;
  sampling_location_id?: number;
  well?: string;
  mode?: string;
  phone?: string;
  selection_conditions?: Record<string, unknown>;
  laboratory_id?: number;
  department_id?: number;
}

export interface SelectionConditionsResponse {
  id: number;
  conditions: Array<{ variable: string; unit: string }>;
  created_at?: string;
  updated_at?: string;
}

export interface SelectionConditionsCreate {
  conditions: Array<{ variable: string; unit: string }>;
}

export interface SelectionConditionsUpdate {
  conditions?: Array<{ variable: string; unit: string }>;
}

export const sampleApi = {
  listSamples: async (params?: {
    laboratory_id?: number;
    department_id?: number;
    page?: number;
    page_size?: number;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const response = await axiosInstance.get<PaginatedResponse<SampleResponse>>('/api/samples/', {
      params,
    });
    return response.data;
  },

  getSample: async (id: number) => {
    const response = await axiosInstance.get<SampleResponse>(`/api/samples/${id}/`);
    return response.data;
  },

  createSample: async (data: SampleCreate) => {
    const response = await axiosInstance.post<SampleResponse>('/api/samples/', data);
    return response.data;
  },

  updateSample: async (id: number, data: SampleUpdate) => {
    const response = await axiosInstance.patch<SampleResponse>(`/api/samples/${id}/`, data);
    return response.data;
  },

  deleteSample: async (id: number) => {
    await axiosInstance.delete(`/api/samples/${id}/`);
  },

  getSelectionConditions: async () => {
    const response = await axiosInstance.get<SelectionConditionsResponse[]>(
      '/api/selection-conditions/'
    );
    return response.data;
  },

  getSelectionCondition: async (id: number) => {
    const response = await axiosInstance.get<SelectionConditionsResponse>(
      `/api/selection-conditions/${id}/`
    );
    return response.data;
  },

  createSelectionConditions: async (data: SelectionConditionsCreate) => {
    const response = await axiosInstance.post<SelectionConditionsResponse>(
      '/api/selection-conditions/',
      data
    );
    return response.data;
  },

  updateSelectionConditions: async (id: number, data: SelectionConditionsUpdate) => {
    const response = await axiosInstance.patch<SelectionConditionsResponse>(
      `/api/selection-conditions/${id}/`,
      data
    );
    return response.data;
  },

  deleteSelectionConditions: async (id: number) => {
    await axiosInstance.delete(`/api/selection-conditions/${id}/`);
  },
};
