import { axiosInstance } from '@/shared/config';
import type {
  ResearchMethodConvergenceConditionsPayload,
  ResearchMethodIntermediateDataPayload,
  ResearchMethodMeasurementErrorPayload,
} from './research';

/** Данные фикстуры методики. */
export interface FixtureData {
  name?: string;
  group_name?: string;
  sample_type?: string | string[];
  formula?: string;
  measurement_error?: Record<string, never> | ResearchMethodMeasurementErrorPayload;
  unit?: string;
  measurement_method?: string;
  nd_code?: string;
  nd_name?: string;
  input_data?: {
    fields: {
      name: string;
      description: string;
      unit?: string;
      card_index: number;
    }[];
  };
  intermediate_data?: Record<string, never> | ResearchMethodIntermediateDataPayload;
  convergence_conditions?: Record<string, never> | ResearchMethodConvergenceConditionsPayload;
  rounding_type?: 'decimal' | 'significant';
  rounding_decimal?: number;
}

/** Запись каталога директорий фикстур. */
export interface FixtureDirectoryEntry {
  path: string;
  paths?: string[];
  label: string;
}

/** Сохранённая методика в дереве фикстур. */
export interface SavedMethodEntry {
  id: number;
  name: string;
  nd_code: string;
  group_name?: string | null;
}

/** Блок подразделения в дереве сохранённых методик. */
export interface SavedDepartmentBlock {
  department_id: number;
  department_name: string;
  methods: SavedMethodEntry[];
}

/** Блок лаборатории в дереве сохранённых методик. */
export interface SavedLaboratoryBlock {
  laboratory_id: number | null;
  laboratory_name: string;
  departments: SavedDepartmentBlock[];
  methods_without_department: SavedMethodEntry[];
}

/** Дерево сохранённых методик. */
export interface SavedMethodsTreeResponse {
  laboratories: SavedLaboratoryBlock[];
}

/** API фикстур методик. */
export const fixturesApi = {
  getFixtures: async (params?: {
    laboratory_name?: string;
    department_name?: string;
  }): Promise<{ fixtures: string[] }> => {
    const response = await axiosInstance.get<{ fixtures: string[] }>('/api/fixtures/', { params });
    return response.data;
  },

  getFixtureDirectories: async (
    laboratoryName: string
  ): Promise<{
    directories: FixtureDirectoryEntry[];
  }> => {
    const response = await axiosInstance.get<{
      directories: FixtureDirectoryEntry[];
    }>('/api/fixtures/meta/directories/', {
      params: { laboratory_name: laboratoryName },
    });
    return response.data;
  },

  getSavedMethodsTree: async (): Promise<SavedMethodsTreeResponse> => {
    const response = await axiosInstance.get<SavedMethodsTreeResponse>(
      '/api/fixtures/meta/saved-methods-tree/'
    );
    return response.data;
  },

  getFixture: async (fixturePath: string): Promise<FixtureData> => {
    const response = await axiosInstance.get<FixtureData>(`/api/fixtures/${fixturePath}`);
    return response.data;
  },

  listFixtureFiles: async (fixturePath: string): Promise<{ files: string[] }> => {
    const response = await axiosInstance.get<{ files: string[] }>(
      `/api/fixtures/${fixturePath}/files/`
    );
    return response.data;
  },
};
