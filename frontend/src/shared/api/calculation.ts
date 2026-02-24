import { axiosInstance } from '../config/axios';

export interface CalculateRequest {
  input_data: Record<string, string | number | Record<string, Record<string, string>>>;
  research_method_id: number;
  equipment_data?: number[];
}

export interface IntermediateResultValue {
  value: string;
  reference: string;
}

export interface CalculationResult {
  result?: string;
  result_reference?: string;
  measurement_error?: string;
  unit?: string;
  convergence?: string;
  intermediate_results?: Record<string, string | IntermediateResultValue>;
  conditions_info?: Array<{
    satisfied: boolean;
    formula?: string;
    calculation_steps?: {
      type?: string;
      step?: {
        evaluated?: string;
      };
      steps?: Array<{
        evaluated?: string;
      }>;
      step2?: string;
    };
    convergence_value?: string;
  }>;
  is_fractional_composition?: boolean;
  updated_input_data?: Record<string, string | number>;
}

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

export interface Calculation {
  id: number;
  sample_id: number;
  laboratory_id: number;
  department_id?: number;
  research_method_id: number;
  input_data: Record<string, unknown>;
  equipment_data?: number[];
  equipment?: EquipmentBrief[];
  result: string;
  executor: string;
  measurement_error?: string;
  unit?: string;
  laboratory_activity_date: string;
  research_method?: {
    id: number;
    name: string;
  };
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface CalculationFilters {
  sample_id?: number;
  research_method_id?: number;
}

export const calculationApi = {
  calculate: async (request: CalculateRequest): Promise<CalculationResult> => {
    const response = await axiosInstance.post<CalculationResult>('/api/calculate/', request);
    return response.data;
  },

  getCalculations: async (
    page?: number,
    pageSize?: number,
    filters?: CalculationFilters,
    sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' }
  ): Promise<{
    items: Calculation[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }> => {
    const params: Record<string, unknown> = {};

    if (page !== undefined) {
      params.page = page;
    }

    if (pageSize !== undefined) {
      params.page_size = pageSize;
    }

    if (filters?.sample_id) {
      params.sample_id = filters.sample_id;
    }

    if (filters?.research_method_id) {
      params.research_method_id = filters.research_method_id;
    }

    if (sorting?.sort_by) {
      params.sort_by = sorting.sort_by;
      params.sort_order = sorting.sort_order || 'desc';
    }

    const response = await axiosInstance.get<{
      items: Calculation[];
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    }>('/api/calculations/', { params });
    return response.data;
  },

  getCalculationsBySample: async (
    sampleId: number,
    sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' }
  ): Promise<Calculation[]> => {
    const params: Record<string, unknown> = {};

    if (sorting?.sort_by) {
      params.sort_by = sorting.sort_by;
      params.sort_order = sorting.sort_order || 'desc';
    }

    const response = await axiosInstance.get<Calculation[]>(
      `/api/calculations/by-sample/${sampleId}/`,
      { params }
    );
    return response.data;
  },

  createCalculation: async (data: {
    sample_id: number;
    laboratory_id: number;
    department_id?: number;
    research_method_id: number;
    input_data: Record<string, unknown>;
    equipment_data?: number[];
    result: string;
    executor: string;
    measurement_error?: string;
    unit?: string;
    laboratory_activity_date: string;
  }): Promise<Calculation> => {
    const response = await axiosInstance.post<Calculation>('/api/calculations/', data);
    return response.data;
  },

  deleteCalculation: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/calculations/${id}/`);
  },
};
