import { axiosInstance } from '@/shared/config';

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

/** Данные для создания филиала. */
export interface BranchCreate {
  name: string;
  phone?: string;
  laboratory_id: number;
  department_id?: number;
}

/** Данные для обновления филиала. */
export interface BranchUpdate {
  name?: string;
  phone?: string;
}

/** API филиалов. */
export const branchesApi = {
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
};
