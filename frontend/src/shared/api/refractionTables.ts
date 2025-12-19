import { axiosInstance } from '../config/axios';
import type { PaginatedResponse } from './research';

export interface MassFractionOilRefractionTable {
  id: number;
  research_method_id: number;
  c_value: string;
  n_value: string;
  research_method_name?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface MassFractionOilRefractionTableCreate {
  research_method_id: number;
  c_value: string;
  n_value: string;
}

export interface MassFractionOilRefractionTableUpdate {
  research_method_id?: number;
  c_value?: string;
  n_value?: string;
}

export interface BulkUpdateRequest {
  research_method_id: number;
  entries: Array<{
    c_value: string | number;
    n_value: string | number;
  }>;
}

export const refractionTablesApi = {
  getRefractionTables: async (
    researchMethodId?: number,
    page?: number,
    pageSize?: number,
    sortBy?: string,
    sortOrder?: string
  ): Promise<PaginatedResponse<MassFractionOilRefractionTable>> => {
    const params: Record<string, unknown> = {};

    if (page !== undefined) {
      params.page = page;
    }

    if (pageSize !== undefined) {
      params.page_size = pageSize;
    }

    if (researchMethodId) {
      params.research_method_id = researchMethodId;
    }

    if (sortBy) {
      params.sort_by = sortBy;
    }

    if (sortOrder) {
      params.sort_order = sortOrder;
    }

    const response = await axiosInstance.get<PaginatedResponse<MassFractionOilRefractionTable>>(
      '/api/mass-fraction-oil-refraction-tables/',
      { params }
    );
    return response.data;
  },

  getRefractionTableById: async (id: number): Promise<MassFractionOilRefractionTable> => {
    const response = await axiosInstance.get<MassFractionOilRefractionTable>(
      `/api/mass-fraction-oil-refraction-tables/${id}/`
    );
    return response.data;
  },

  createRefractionTable: async (
    data: MassFractionOilRefractionTableCreate
  ): Promise<MassFractionOilRefractionTable> => {
    const response = await axiosInstance.post<MassFractionOilRefractionTable>(
      '/api/mass-fraction-oil-refraction-tables/',
      data
    );
    return response.data;
  },

  updateRefractionTable: async (
    id: number,
    data: MassFractionOilRefractionTableUpdate
  ): Promise<MassFractionOilRefractionTable> => {
    const response = await axiosInstance.patch<MassFractionOilRefractionTable>(
      `/api/mass-fraction-oil-refraction-tables/${id}/`,
      data
    );
    return response.data;
  },

  deleteRefractionTable: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/mass-fraction-oil-refraction-tables/${id}/`);
  },

  bulkUpdate: async (data: BulkUpdateRequest): Promise<{ message: string }> => {
    const response = await axiosInstance.post<{ message: string }>(
      '/api/mass-fraction-oil-refraction-tables/bulk-update/',
      data
    );
    return response.data;
  },
};
