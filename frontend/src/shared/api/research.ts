import { axiosInstance } from '../config/axios';

export interface ResearchMethod {
  id: number;
  name: string;
  sample_type: string[];
  formula: string;
  measurement_error: {
    type: 'fixed' | 'formula';
    value: string;
    ranges?: Array<{ formula: string; value: string }>;
  };
  unit: string;
  measurement_method: string;
  nd_code: string;
  nd_name: string;
  input_data: {
    fields: Array<{
      name: string;
      description: string;
      unit?: string;
      card_index: number;
    }>;
  };
  intermediate_data: {
    fields: Array<{
      name: string;
      formula: string;
      description: string;
      unit?: string;
      show_calculation: boolean;
      use_multiple_rounding?: boolean;
      multiple_value?: string;
      use_result_rounding?: boolean;
      rounding_type?: 'decimal' | 'significant';
      rounding_decimal?: number;
      range_calculation?: {
        ranges: Array<{ condition: string; formula: string }>;
      };
      use_threshold_table?: boolean;
      threshold_table_values?: {
        target_variable: string;
        higher_variable: string;
        lower_variable: string;
      };
    }>;
  };
  convergence_conditions: {
    formulas: Array<{
      formula: string;
      convergence_value: string;
      custom_value?: string;
    }>;
  };
  rounding_type: 'decimal' | 'significant';
  rounding_decimal: number;
  is_group_member: boolean;
  groups?: Array<{ id: number; name: string }>;
  equipment_data_default?: number[];
  sort_order?: number;
  laboratory_id?: number;
  department_id?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface ResearchMethodCreate {
  name: string;
  sample_type: string[];
  formula: string;
  measurement_error: {
    type: 'fixed' | 'formula';
    value: string;
    ranges?: Array<{ formula: string; value: string }>;
  };
  unit: string;
  measurement_method: string;
  nd_code: string;
  nd_name: string;
  input_data: {
    fields: Array<{
      name: string;
      description: string;
      unit?: string;
      card_index: number;
    }>;
  };
  intermediate_data: {
    fields: Array<{
      name: string;
      formula: string;
      description: string;
      unit?: string;
      show_calculation: boolean;
      use_multiple_rounding?: boolean;
      multiple_value?: string;
      use_result_rounding?: boolean;
      rounding_type?: 'decimal' | 'significant';
      rounding_decimal?: number;
      range_calculation?: {
        ranges: Array<{ condition: string; formula: string }>;
      };
      use_threshold_table?: boolean;
      threshold_table_values?: {
        target_variable: string;
        higher_variable: string;
        lower_variable: string;
      };
    }>;
  };
  convergence_conditions?: {
    formulas: Array<{
      formula: string;
      convergence_value: string;
      custom_value?: string;
    }>;
  };
  rounding_type: 'decimal' | 'significant';
  rounding_decimal: number;
  is_group_member?: boolean;
  equipment_data_default?: number[];
  sort_order?: number;
  laboratory_id?: number;
  department_id?: number;
}

export interface ResearchMethodGroup {
  id: number;
  name: string;
  methods: Array<{ id: number; name: string }>;
  sort_order?: number;
  created_at: string;
  deleted_at?: string;
}

export interface ResearchMethodGroupCreate {
  name: string;
  method_ids: number[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const researchApi = {
  getResearchMethods: async (params?: {
    laboratory_id?: number;
    department_id?: number;
    page?: number;
    page_size?: number;
    search?: string;
    rounding_type?: string;
    sort_by?: string;
    sort_order?: string;
  }): Promise<PaginatedResponse<ResearchMethod>> => {
    const response = await axiosInstance.get('/api/research-methods/', { params });
    return response.data;
  },

  getResearchMethod: async (id: number): Promise<ResearchMethod> => {
    const response = await axiosInstance.get(`/api/research-methods/${id}/`);
    return response.data;
  },

  createResearchMethod: async (data: ResearchMethodCreate): Promise<ResearchMethod> => {
    const response = await axiosInstance.post('/api/research-methods/', data);
    return response.data;
  },

  updateResearchMethod: async (
    id: number,
    data: Partial<ResearchMethodCreate>
  ): Promise<ResearchMethod> => {
    const response = await axiosInstance.patch(`/api/research-methods/${id}/`, data);
    return response.data;
  },

  deleteResearchMethod: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/research-methods/${id}/`);
  },

  updateResearchMethodSortOrder: async (id: number, sortOrder: number): Promise<ResearchMethod> => {
    const response = await axiosInstance.patch(`/api/research-methods/${id}/sort-order/`, {
      sort_order: sortOrder,
    });
    return response.data;
  },

  getResearchMethodGroups: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    sort_by?: string;
    sort_order?: string;
  }): Promise<PaginatedResponse<ResearchMethodGroup>> => {
    const response = await axiosInstance.get('/api/research-method-groups/', { params });
    return response.data;
  },

  getResearchMethodGroup: async (id: number): Promise<ResearchMethodGroup> => {
    const response = await axiosInstance.get(`/api/research-method-groups/${id}/`);
    return response.data;
  },

  createResearchMethodGroup: async (
    data: ResearchMethodGroupCreate
  ): Promise<ResearchMethodGroup> => {
    const response = await axiosInstance.post('/api/research-method-groups/', data);
    return response.data;
  },

  updateResearchMethodGroup: async (
    id: number,
    data: Partial<ResearchMethodGroupCreate & { sort_order?: number }>
  ): Promise<ResearchMethodGroup> => {
    const response = await axiosInstance.patch(`/api/research-method-groups/${id}/`, data);
    return response.data;
  },

  deleteResearchMethodGroup: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/research-method-groups/${id}/`);
  },

  batchUpdateSortOrder: async (
    items: Array<{ id: number; type: 'method' | 'group'; sort_order: number }>
  ): Promise<void> => {
    await axiosInstance.patch('/api/sort-order/batch/', { items });
  },

  getAvailableResearchMethods: async (params: {
    laboratory_id: number;
    department_id?: number;
    sample_id?: number;
  }): Promise<{
    methods: Array<{
      id: number | string;
      name: string;
      is_group?: boolean;
      group_id?: number;
      methods?: Array<{
        id: number;
        name: string;
        input_data?: ResearchMethod['input_data'];
        intermediate_data?: ResearchMethod['intermediate_data'];
        unit?: string;
        equipment_data_default?: number[];
        sort_order?: number;
      }>;
      input_data?: ResearchMethod['input_data'];
      intermediate_data?: ResearchMethod['intermediate_data'];
      unit?: string;
      equipment_data_default?: number[];
      sort_order?: number;
    }>;
  }> => {
    const response = await axiosInstance.get('/api/research-methods/available/', { params });
    return response.data;
  },
};
