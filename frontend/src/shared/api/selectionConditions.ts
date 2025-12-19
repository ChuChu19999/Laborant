import { axiosInstance } from '../config/axios';
import type { PaginatedResponse } from './research';

export interface SelectionCondition {
  variable: string;
  unit: string;
}

export interface SelectionConditions {
  id: number;
  conditions: SelectionCondition[];
  laboratory_id?: number;
  department_id?: number;
  laboratory_name?: string;
  department_name?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface SelectionConditionsCreate {
  conditions: SelectionCondition[];
  laboratory_id?: number;
  department_id?: number;
}

export interface SelectionConditionsUpdate {
  conditions?: SelectionCondition[];
  laboratory_id?: number;
  department_id?: number;
}

export const selectionConditionsApi = {
  getSelectionConditions: async (
    laboratoryId?: number,
    departmentId?: number,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<SelectionConditions>> => {
    const params: Record<string, unknown> = {};

    if (page !== undefined) {
      params.page = page;
    }

    if (pageSize !== undefined) {
      params.page_size = pageSize;
    }

    if (laboratoryId) {
      params.laboratory_id = laboratoryId;
    }

    if (departmentId) {
      params.department_id = departmentId;
    }

    const response = await axiosInstance.get<PaginatedResponse<SelectionConditions>>(
      '/api/selection-conditions/',
      { params }
    );
    return response.data;
  },

  getSelectionConditionsById: async (id: number): Promise<SelectionConditions> => {
    const response = await axiosInstance.get<SelectionConditions>(
      `/api/selection-conditions/${id}/`
    );
    return response.data;
  },

  createSelectionConditions: async (
    data: SelectionConditionsCreate
  ): Promise<SelectionConditions> => {
    const response = await axiosInstance.post<SelectionConditions>(
      '/api/selection-conditions/',
      data
    );
    return response.data;
  },

  updateSelectionConditions: async (
    id: number,
    data: SelectionConditionsUpdate
  ): Promise<SelectionConditions> => {
    const response = await axiosInstance.patch<SelectionConditions>(
      `/api/selection-conditions/${id}/`,
      data
    );
    return response.data;
  },

  deleteSelectionConditions: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/selection-conditions/${id}/`);
  },
};
