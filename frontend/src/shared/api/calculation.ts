import { axiosInstance } from '../config/axios';
import type { PaginatedResponse } from './types';

export interface EquipmentBrief {
  id: number;
  name: string;
  serial_number: string;
  verification_info: string;
  verification_date: string;
  verification_end_date: string;
  type: string;
  version: string;
}

export interface CalculationResponse {
  id: number;
  input_data: Record<string, unknown>;
  equipment_data?: number[];
  equipment?: EquipmentBrief[];
  result: string;
  executor: string;
  measurement_error?: string;
  unit?: string;
  laboratory_activity_date: string;
  sample_id: number;
  laboratory_id: number;
  department_id?: number;
  research_method_id: number;
  sample?: Record<string, unknown>;
  research_method?: {
    id: number;
    name: string;
    unit: string;
  };
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface CalculationCreate {
  input_data: Record<string, unknown>;
  equipment_data?: number[];
  result: string;
  executor: string;
  measurement_error?: string;
  unit?: string;
  laboratory_activity_date: string;
  sample_id: number;
  laboratory_id: number;
  department_id?: number;
  research_method_id: number;
}

export interface CalculationUpdate {
  input_data?: Record<string, unknown>;
  equipment_data?: number[];
  result?: string;
  executor?: string;
  measurement_error?: string;
  unit?: string;
  laboratory_activity_date?: string;
  sample_id?: number;
  laboratory_id?: number;
  department_id?: number;
  research_method_id?: number;
}

export interface CalculateRequest {
  input_data: Record<string, unknown>;
  research_method_id: number;
  equipment_data?: number[];
}

export interface CalculateResponse {
  result: string;
  intermediate_data?: Record<string, unknown>;
  measurement_error?: string;
  unit?: string;
}

export const calculationApi = {
  listCalculations: async (params?: {
    sample_id?: number;
    sample_ids?: string;
    laboratory_id?: number;
    department_id?: number;
    research_method_id?: number;
    include_deleted?: boolean;
    page?: number;
    page_size?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const response = await axiosInstance.get<PaginatedResponse<CalculationResponse>>(
      '/api/calculations/',
      { params }
    );
    return response.data;
  },

  getCalculation: async (id: number) => {
    const response = await axiosInstance.get<CalculationResponse>(`/api/calculations/${id}/`);
    return response.data;
  },

  createCalculation: async (data: CalculationCreate) => {
    const response = await axiosInstance.post<CalculationResponse>('/api/calculations/', data);
    return response.data;
  },

  updateCalculation: async (id: number, data: CalculationUpdate) => {
    const response = await axiosInstance.patch<CalculationResponse>(
      `/api/calculations/${id}/`,
      data
    );
    return response.data;
  },

  deleteCalculation: async (id: number) => {
    await axiosInstance.delete(`/api/calculations/${id}/`);
  },

  calculate: async (data: CalculateRequest) => {
    const response = await axiosInstance.post<CalculateResponse>(
      '/api/calculations/calculate/',
      data
    );
    return response.data;
  },
};
