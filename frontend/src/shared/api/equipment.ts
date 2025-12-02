import { axiosInstance } from '../config/axios';
import type { PaginatedResponse } from './types';

export interface EquipmentResponse {
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
  laboratory_name?: string;
  department_name?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface EquipmentCreate {
  type: string;
  name: string;
  serial_number: string;
  verification_info: string;
  verification_date: string;
  verification_end_date: string;
  version: string;
  laboratory_id: number;
  department_id?: number;
}

export interface EquipmentUpdate {
  type?: string;
  name?: string;
  serial_number?: string;
  verification_info?: string;
  verification_date?: string;
  verification_end_date?: string;
  version?: string;
  laboratory_id?: number;
  department_id?: number;
}

export const equipmentApi = {
  listEquipment: async (params?: {
    laboratory_id?: number;
    department_id?: number;
    equipment_type?: string;
    page?: number;
    page_size?: number;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const response = await axiosInstance.get<PaginatedResponse<EquipmentResponse>>(
      '/api/equipment/',
      { params }
    );
    return response.data;
  },

  getEquipment: async (id: number) => {
    const response = await axiosInstance.get<EquipmentResponse>(`/api/equipment/${id}/`);
    return response.data;
  },

  createEquipment: async (data: EquipmentCreate) => {
    const response = await axiosInstance.post<EquipmentResponse>('/api/equipment/', data);
    return response.data;
  },

  updateEquipment: async (id: number, data: EquipmentUpdate) => {
    const response = await axiosInstance.patch<EquipmentResponse>(`/api/equipment/${id}/`, data);
    return response.data;
  },

  deleteEquipment: async (id: number) => {
    await axiosInstance.delete(`/api/equipment/${id}/`);
  },
};
