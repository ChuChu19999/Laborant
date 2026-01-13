import { axiosInstance } from '../config/axios';
import type { PaginatedResponse } from './research';

export interface Equipment {
  id: number;
  type: string;
  name: string;
  serial_number: string;
  verification_info: string;
  verification_date: string;
  verification_end_date: string;
  version: string;
  laboratory_id: number;
  department_id?: number;
  method_data_default?: number[];
  laboratory_name?: string;
  department_name?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface EquipmentCreate {
  type: string;
  name: string;
  serial_number: string;
  verification_info: string;
  verification_date: string;
  verification_end_date: string;
  laboratory_id: number;
  department_id?: number;
  method_data_default?: number[];
}

export interface EquipmentUpdate {
  type?: string;
  name?: string;
  serial_number?: string;
  verification_info?: string;
  verification_date?: string;
  verification_end_date?: string;
  laboratory_id?: number;
  department_id?: number;
  method_data_default?: number[];
}

export interface EquipmentFilters {
  name?: string;
  serial_number?: string;
  type?: string;
  types?: string[];
  verification_date_from?: string;
  verification_date_to?: string;
  verification_end_date_from?: string;
  verification_end_date_to?: string;
  created_at_from?: string;
  created_at_to?: string;
  [key: string]: unknown;
}

export const equipmentApi = {
  getEquipment: async (
    page?: number,
    pageSize?: number,
    filters?: EquipmentFilters,
    sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' },
    laboratoryId?: number,
    departmentId?: number
  ): Promise<PaginatedResponse<Equipment>> => {
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

    if (filters?.name || filters?.serial_number) {
      params.search = filters.name || filters.serial_number;
    }

    if (filters?.types && filters.types.length > 0) {
      params.equipment_types = filters.types;
    } else if (filters?.type) {
      params.equipment_type = filters.type;
    }

    if (filters?.verification_date_from) {
      params.verification_date_from = filters.verification_date_from;
    }
    if (filters?.verification_date_to) {
      params.verification_date_to = filters.verification_date_to;
    }
    if (filters?.verification_end_date_from) {
      params.verification_end_date_from = filters.verification_end_date_from;
    }
    if (filters?.verification_end_date_to) {
      params.verification_end_date_to = filters.verification_end_date_to;
    }
    if (filters?.created_at_from) {
      params.created_at_from = filters.created_at_from;
    }
    if (filters?.created_at_to) {
      params.created_at_to = filters.created_at_to;
    }

    if (sorting?.sort_by) {
      params.sort_by = sorting.sort_by;
      params.sort_order = sorting.sort_order || 'desc';
    }

    const response = await axiosInstance.get<PaginatedResponse<Equipment>>('/api/equipment/', {
      params,
    });
    return response.data;
  },

  getEquipmentById: async (id: number): Promise<Equipment> => {
    const response = await axiosInstance.get<Equipment>(`/api/equipment/${id}/`);
    return response.data;
  },

  createEquipment: async (data: EquipmentCreate): Promise<Equipment> => {
    const response = await axiosInstance.post<Equipment>('/api/equipment/', data);
    return response.data;
  },

  updateEquipment: async (id: number, data: EquipmentUpdate): Promise<Equipment> => {
    const response = await axiosInstance.patch<Equipment>(`/api/equipment/${id}/`, data);
    return response.data;
  },

  deleteEquipment: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/equipment/${id}/`);
  },
};
