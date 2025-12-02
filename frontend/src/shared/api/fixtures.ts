import { axiosInstance } from '../config/axios';

export interface FixtureData {
  name: string;
  group_name?: string;
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
}

export const fixturesApi = {
  listFixtures: async (params?: { laboratory_name?: string; department_name?: string }) => {
    const response = await axiosInstance.get<{ fixtures: string[] }>('/api/fixtures/', {
      params,
    });
    return response.data.fixtures;
  },

  getFixture: async (fixturePath: string) => {
    const response = await axiosInstance.get<FixtureData>(`/api/fixtures/${fixturePath}`);
    return response.data;
  },

  listFixtureFiles: async (fixturePath: string) => {
    const response = await axiosInstance.get<{ files: string[] }>(
      `/api/fixtures/${fixturePath}/files/`
    );
    return response.data.files;
  },
};
