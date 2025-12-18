import { axiosInstance } from '../config/axios';
import type { PaginatedResponse } from './research';

export interface Sample {
  id: number;
  registration_number: string;
  sample_type: string;
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
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface SampleCreate {
  registration_number: string;
  sample_type: string;
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
  sample_type?: string;
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

export interface SampleFilters {
  registration_number?: string;
  test_object?: string;
  sampling_location?: string;
  sampling_date_from?: string;
  sampling_date_to?: string;
  receiving_date_from?: string;
  receiving_date_to?: string;
  created_at_from?: string;
  created_at_to?: string;
  [key: string]: unknown;
}

export interface SelectionConditionsField {
  variable: string;
  unit: string;
}

export const samplesApi = {
  getSampleTypes: async (): Promise<string[]> => {
    const response = await axiosInstance.get<string[]>('/api/sample-types/');
    return response.data;
  },

  getSamples: async (
    page: number,
    pageSize: number,
    filters?: SampleFilters,
    sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' },
    laboratoryId?: number,
    departmentId?: number
  ): Promise<PaginatedResponse<Sample>> => {
    const params: Record<string, unknown> = {
      page,
      page_size: pageSize,
    };

    if (laboratoryId) {
      params.laboratory_id = laboratoryId;
    }

    if (departmentId) {
      params.department_id = departmentId;
    }

    if (filters?.registration_number) {
      params.search = filters.registration_number;
    }

    if (filters?.test_object) {
      params.search = filters.test_object;
    }

    if (filters?.sampling_location) {
      params.search_sampling_location = filters.sampling_location;
    }

    if (sorting?.sort_by) {
      params.sort_by = sorting.sort_by;
      params.sort_order = sorting.sort_order || 'desc';
    }

    const response = await axiosInstance.get<PaginatedResponse<Sample>>('/api/samples/', {
      params,
    });
    return response.data;
  },

  getSample: async (id: number): Promise<Sample> => {
    const response = await axiosInstance.get<Sample>(`/api/samples/${id}/`);
    return response.data;
  },

  createSample: async (data: SampleCreate): Promise<Sample> => {
    const response = await axiosInstance.post<Sample>('/api/samples/', data);
    return response.data;
  },

  updateSample: async (id: number, data: SampleUpdate): Promise<Sample> => {
    const response = await axiosInstance.patch<Sample>(`/api/samples/${id}/`, data);
    return response.data;
  },

  deleteSample: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/samples/${id}/`);
  },

  getSelectionConditionsFields: async (
    laboratoryId: number,
    departmentId?: number
  ): Promise<SelectionConditionsField[]> => {
    const params: Record<string, unknown> = {
      laboratory_id: laboratoryId,
    };

    if (departmentId) {
      params.department_id = departmentId;
    }

    const response = await axiosInstance.get<
      PaginatedResponse<{ conditions: SelectionConditionsField[] }>
    >('/api/selection-conditions/', { params });

    if (response.data.items.length > 0) {
      return response.data.items[0].conditions;
    }

    return [];
  },
};
