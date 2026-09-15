import { axiosInstance } from '@/shared/config';

export interface TestPurpose {
  id: number;
  name: string;
  laboratory_id: number;
  department_id?: number | null;
  laboratory_name?: string | null;
  department_name?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/** Данные для создания цели испытаний. */
export interface TestPurposeCreate {
  name: string;
  laboratory_id: number;
  department_id?: number | null;
}

/** Данные для обновления цели испытаний. */
export interface TestPurposeUpdate {
  name?: string;
  laboratory_id?: number;
  department_id?: number | null;
}

export interface TestPurposeListParams {
  laboratory_id?: number;
  department_id?: number;
  search?: string;
  sort_by?: string;
  sort_order?: string;
}

/** API целей испытаний. */
export const testPurposesApi = {
  getTestPurposes: async (params?: TestPurposeListParams): Promise<{ items: TestPurpose[] }> => {
    const response = await axiosInstance.get<TestPurpose[]>('/api/test-purposes/', {
      params,
    });
    return { items: response.data };
  },

  getTestPurpose: async (id: number): Promise<TestPurpose> => {
    const response = await axiosInstance.get<TestPurpose>(`/api/test-purposes/${id}/`);
    return response.data;
  },

  createTestPurpose: async (data: TestPurposeCreate): Promise<TestPurpose> => {
    const response = await axiosInstance.post<TestPurpose>('/api/test-purposes/', data);
    return response.data;
  },

  updateTestPurpose: async (id: number, data: TestPurposeUpdate): Promise<TestPurpose> => {
    const response = await axiosInstance.patch<TestPurpose>(`/api/test-purposes/${id}/`, data);
    return response.data;
  },

  deleteTestPurpose: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/test-purposes/${id}/`);
  },
};
