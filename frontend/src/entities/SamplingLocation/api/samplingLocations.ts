import { axiosInstance } from '@/shared/config';

export interface SamplingLocation {
  id: number;
  name: string;
  branch_id: number;
  branch_name?: string;
  branch_phone?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/** Данные для создания места отбора. */
export interface SamplingLocationCreate {
  name: string;
  branch_id: number;
}

/** Данные для обновления места отбора. */
export interface SamplingLocationUpdate {
  name?: string;
  branch_id?: number;
}

/** API мест отбора проб. */
export const samplingLocationsApi = {
  getSamplingLocations: async (
    branchId?: number,
    params?: {
      search?: string;
      sort_by?: string;
      sort_order?: string;
    }
  ): Promise<{ items: SamplingLocation[] }> => {
    const queryParams: Record<string, unknown> = {
      ...params,
    };

    if (branchId) {
      queryParams.branch_id = branchId;
    }

    const response = await axiosInstance.get<SamplingLocation[]>(
      '/api/laboratories/sampling-locations/',
      {
        params: queryParams,
      }
    );
    return { items: response.data };
  },

  getSamplingLocation: async (id: number): Promise<SamplingLocation> => {
    const response = await axiosInstance.get<SamplingLocation>(
      `/api/laboratories/sampling-locations/${id}/`
    );
    return response.data;
  },

  createSamplingLocation: async (data: SamplingLocationCreate): Promise<SamplingLocation> => {
    const response = await axiosInstance.post<SamplingLocation>(
      '/api/laboratories/sampling-locations/',
      data
    );
    return response.data;
  },

  updateSamplingLocation: async (
    id: number,
    data: SamplingLocationUpdate
  ): Promise<SamplingLocation> => {
    const response = await axiosInstance.patch<SamplingLocation>(
      `/api/laboratories/sampling-locations/${id}/`,
      data
    );
    return response.data;
  },

  deleteSamplingLocation: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/laboratories/sampling-locations/${id}/`);
  },
};
