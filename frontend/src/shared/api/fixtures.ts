import { axiosInstance } from '../config/axios';

export interface FixtureData {
  name?: string;
  group_name?: string;
  sample_type?: string | string[];
  formula?: string;
  measurement_error?: {
    type: 'fixed' | 'formula';
    value: string;
    ranges?: Array<{ formula: string; value: string }>;
  };
  unit?: string;
  measurement_method?: string;
  nd_code?: string;
  nd_name?: string;
  input_data?: {
    fields: Array<{
      name: string;
      description: string;
      unit?: string;
      card_index: number;
    }>;
  };
  intermediate_data?: {
    fields: Array<{
      name: string;
      formula: string;
      description: string;
      unit?: string;
      show_calculation: boolean;
      use_multiple_rounding?: boolean;
      multiple_value?: string;
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
  rounding_type?: 'decimal' | 'significant';
  rounding_decimal?: number;
}

export const fixturesApi = {
  getFixtures: async (params?: {
    laboratory_name?: string;
    department_name?: string;
  }): Promise<{ fixtures: string[] }> => {
    const response = await axiosInstance.get('/api/fixtures/', { params });
    return response.data;
  },

  getFixture: async (fixturePath: string): Promise<FixtureData> => {
    const response = await axiosInstance.get(`/api/fixtures/${fixturePath}`);
    return response.data;
  },

  listFixtureFiles: async (fixturePath: string): Promise<{ files: string[] }> => {
    const response = await axiosInstance.get(`/api/fixtures/${fixturePath}/files/`);
    return response.data;
  },
};
