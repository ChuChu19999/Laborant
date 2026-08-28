import { axiosInstance } from '@/shared/config';

export interface WellMode {
  id: number;
  name: string;
  branch_id: number;
  branch_name?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/** Данные для создания режима скважины. */
export interface WellModeCreate {
  name: string;
  branch_id: number;
}

/** Данные для обновления режима скважины. */
export interface WellModeUpdate {
  name?: string;
}

/** API режимов скважин. */
export const wellModesApi = {
  getWellModes: async (
    branchId?: number,
    params?: {
      search?: string;
      sort_by?: string;
      sort_order?: string;
    }
  ): Promise<{ items: WellMode[] }> => {
    const queryParams: Record<string, unknown> = {
      ...params,
    };

    if (branchId) {
      queryParams.branch_id = branchId;
    }

    const response = await axiosInstance.get<WellMode[]>('/api/laboratories/well-modes/', {
      params: queryParams,
    });
    return { items: response.data };
  },

  getWellMode: async (id: number): Promise<WellMode> => {
    const response = await axiosInstance.get<WellMode>(`/api/laboratories/well-modes/${id}/`);
    return response.data;
  },

  createWellMode: async (data: WellModeCreate): Promise<WellMode> => {
    const response = await axiosInstance.post<WellMode>('/api/laboratories/well-modes/', data);
    return response.data;
  },

  updateWellMode: async (id: number, data: WellModeUpdate): Promise<WellMode> => {
    const response = await axiosInstance.patch<WellMode>(
      `/api/laboratories/well-modes/${id}/`,
      data
    );
    return response.data;
  },

  deleteWellMode: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/laboratories/well-modes/${id}/`);
  },
};
