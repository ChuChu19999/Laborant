import { axiosInstance } from '@/shared/config';

export interface SampleType {
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

/** Данные для создания типа пробы. */
export interface SampleTypeCreate {
  name: string;
  laboratory_id: number;
  department_id?: number | null;
}

/** Данные для обновления типа пробы. */
export interface SampleTypeUpdate {
  name?: string;
  laboratory_id?: number;
  department_id?: number | null;
}

export interface SampleTypeListParams {
  laboratory_id?: number;
  department_id?: number;
  search?: string;
  sort_by?: string;
  sort_order?: string;
}

/** API типов проб. */
export const sampleTypesApi = {
  getSampleTypes: async (params?: SampleTypeListParams): Promise<{ items: SampleType[] }> => {
    const response = await axiosInstance.get<SampleType[]>('/api/sample-types/', {
      params,
    });
    return { items: response.data };
  },

  getSampleType: async (id: number): Promise<SampleType> => {
    const response = await axiosInstance.get<SampleType>(`/api/sample-types/${id}/`);
    return response.data;
  },

  createSampleType: async (data: SampleTypeCreate): Promise<SampleType> => {
    const response = await axiosInstance.post<SampleType>('/api/sample-types/', data);
    return response.data;
  },

  updateSampleType: async (id: number, data: SampleTypeUpdate): Promise<SampleType> => {
    const response = await axiosInstance.patch<SampleType>(`/api/sample-types/${id}/`, data);
    return response.data;
  },

  deleteSampleType: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/sample-types/${id}/`);
  },
};
