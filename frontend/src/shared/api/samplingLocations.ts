import { axiosInstance } from '../config/axios';

export interface Branch {
  id: number;
  name: string;
  phone?: string;
  laboratory_id: number;
  department_id?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

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

export interface BranchCreate {
  name: string;
  phone?: string;
  laboratory_id: number;
  department_id?: number;
}

export interface BranchUpdate {
  name?: string;
  phone?: string;
}

export interface SamplingLocationCreate {
  name: string;
  branch_id: number;
}

export interface SamplingLocationUpdate {
  name?: string;
  branch_id?: number;
}

export interface WellMode {
  id: number;
  name: string;
  branch_id: number;
  branch_name?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface WellModeCreate {
  name: string;
  branch_id: number;
}

export interface WellModeUpdate {
  name?: string;
}

export const samplingLocationsApi = {
  getBranches: async (
    laboratoryId?: number,
    departmentId?: number,
    params?: {
      search?: string;
      sort_by?: string;
      sort_order?: string;
    }
  ): Promise<{ items: Branch[] }> => {
    const queryParams: Record<string, unknown> = {
      ...params,
    };

    if (laboratoryId) {
      queryParams.laboratory_id = laboratoryId;
    }

    if (departmentId) {
      queryParams.department_id = departmentId;
    }

    const response = await axiosInstance.get<Branch[]>('/api/branches/', {
      params: queryParams,
    });
    return { items: response.data };
  },

  getBranch: async (id: number): Promise<Branch> => {
    const response = await axiosInstance.get<Branch>(`/api/branches/${id}/`);
    return response.data;
  },

  createBranch: async (data: BranchCreate): Promise<Branch> => {
    const response = await axiosInstance.post<Branch>('/api/branches/', data);
    return response.data;
  },

  updateBranch: async (id: number, data: BranchUpdate): Promise<Branch> => {
    const response = await axiosInstance.patch<Branch>(`/api/branches/${id}/`, data);
    return response.data;
  },

  deleteBranch: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/branches/${id}/`);
  },

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
