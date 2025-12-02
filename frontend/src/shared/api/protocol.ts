import { axiosInstance } from '../config/axios';
import type { PaginatedResponse } from './types';

export interface ProtocolResponse {
  id: number;
  test_protocol_number?: string;
  test_protocol_date?: string;
  is_accredited: boolean;
  sampling_act_number: string;
  issued?: string;
  approved?: string;
  issued_position?: string;
  approved_position?: string;
  samples?: number[];
  samples_data?: Array<Record<string, unknown>>;
  laboratory_id: number;
  department_id?: number;
  protocol_template_id?: number;
  laboratory_name?: string;
  department_name?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface ProtocolTemplateResponse {
  id: number;
  name: string;
  file_name: string;
  accreditation_header_row?: number;
  laboratory_id: number;
  department_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProtocolCreate {
  test_protocol_number?: string;
  test_protocol_date?: string;
  is_accredited?: boolean;
  sampling_act_number: string;
  issued?: string;
  approved?: string;
  issued_position?: string;
  approved_position?: string;
  samples?: number[];
  laboratory_id: number;
  department_id?: number;
  protocol_template_id?: number;
}

export interface ProtocolUpdate {
  test_protocol_number?: string;
  test_protocol_date?: string;
  is_accredited?: boolean;
  sampling_act_number?: string;
  issued?: string;
  approved?: string;
  issued_position?: string;
  approved_position?: string;
  protocol_template_id?: number;
  samples?: number[];
  laboratory_id?: number;
  department_id?: number;
}

export interface ProtocolTemplateCreate {
  name: string;
  file_name: string;
  file: string;
  accreditation_header_row?: number;
  laboratory_id: number;
  department_id?: number;
}

export interface ProtocolTemplateUpdate {
  name?: string;
  file?: string;
  file_name?: string;
  accreditation_header_row?: number;
}

export const protocolApi = {
  listProtocols: async (params?: {
    laboratory_id?: number;
    department_id?: number;
    include_deleted?: boolean;
    page?: number;
    page_size?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const response = await axiosInstance.get<PaginatedResponse<ProtocolResponse>>(
      '/api/protocols/',
      { params }
    );
    return response.data;
  },

  getProtocol: async (id: number) => {
    const response = await axiosInstance.get<ProtocolResponse>(`/api/protocols/${id}/`);
    return response.data;
  },

  createProtocol: async (data: ProtocolCreate) => {
    const response = await axiosInstance.post<ProtocolResponse>('/api/protocols/', data);
    return response.data;
  },

  updateProtocol: async (id: number, data: ProtocolUpdate) => {
    const response = await axiosInstance.patch<ProtocolResponse>(`/api/protocols/${id}/`, data);
    return response.data;
  },

  deleteProtocol: async (id: number) => {
    await axiosInstance.delete(`/api/protocols/${id}/`);
  },

  generateProtocol: async (id: number) => {
    const response = await axiosInstance.get(`/api/protocols/${id}/generate/`, {
      responseType: 'blob',
    });
    return response.data;
  },

  listProtocolTemplates: async (params?: {
    laboratory_id?: number;
    department_id?: number;
    page?: number;
    page_size?: number;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const response = await axiosInstance.get<PaginatedResponse<ProtocolTemplateResponse>>(
      '/api/protocol-templates/',
      { params }
    );
    return response.data;
  },

  getProtocolTemplate: async (id: number) => {
    const response = await axiosInstance.get<ProtocolTemplateResponse>(
      `/api/protocol-templates/${id}/`
    );
    return response.data;
  },

  createProtocolTemplate: async (data: ProtocolTemplateCreate) => {
    const response = await axiosInstance.post<ProtocolTemplateResponse>(
      '/api/protocol-templates/',
      data
    );
    return response.data;
  },

  updateProtocolTemplate: async (id: number, data: ProtocolTemplateUpdate) => {
    const response = await axiosInstance.patch<ProtocolTemplateResponse>(
      `/api/protocol-templates/${id}/`,
      data
    );
    return response.data;
  },

  deleteProtocolTemplate: async (id: number) => {
    await axiosInstance.delete(`/api/protocol-templates/${id}/`);
  },
};
