import { axiosInstance } from '@/shared/config';
import type { PaginatedResponse } from '@/shared/lib/http';

/** Параметр условия отбора. */
export interface SelectionCondition {
  variable: string;
  unit: string;
}

/** Поле условия отбора для формы пробы. */
export type SelectionConditionsField = SelectionCondition;

/** Набор условий отбора. */
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

/** Данные для создания условий отбора. */
export interface SelectionConditionsCreate {
  conditions: SelectionCondition[];
  laboratory_id?: number;
  department_id?: number;
}

/** Данные для обновления условий отбора. */
export interface SelectionConditionsUpdate {
  conditions?: SelectionCondition[];
  laboratory_id?: number;
  department_id?: number;
}

/** API условий отбора. */
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

  /** Возвращает поля условий отбора для лаборатории или подразделения. */
  getSelectionConditionsFields: async (
    laboratoryId: number,
    departmentId?: number
  ): Promise<SelectionConditionsField[]> => {
    const params: Record<string, unknown> = {
      laboratory_id: laboratoryId,
    };

    if (departmentId) {
      params.department_id = departmentId;
    }

    const response = await axiosInstance.get<
      PaginatedResponse<{ conditions: SelectionConditionsField[] }>
    >('/api/selection-conditions/', { params });

    if (response.data.items.length > 0) {
      return response.data.items[0]?.conditions ?? [];
    }

    return [];
  },
};
