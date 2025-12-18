import { axiosInstance } from '../config/axios';
import type { PaginatedResponse } from './research';
import type { Sample } from './samples';

export interface Protocol {
  id: number;
  test_protocol_number?: string;
  test_protocol_date?: string;
  is_accredited: boolean;
  sampling_act_number: string;
  issued?: string;
  approved?: string;
  issued_position?: string;
  approved_position?: string;
  protocol_template_id?: number;
  laboratory_id: number;
  department_id?: number;
  samples?: number[];
  samples_data?: Sample[];
  laboratory_name?: string;
  department_name?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
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
  protocol_template_id?: number;
  laboratory_id: number;
  department_id?: number;
  samples?: number[];
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
  laboratory_id?: number;
  department_id?: number;
  samples?: number[];
}

export interface ProtocolFilters {
  test_protocol_number?: string;
  sampling_act_number?: string;
  is_accredited?: boolean;
  test_protocol_date_from?: string;
  test_protocol_date_to?: string;
  test_protocol_date_search?: string;
  created_at_from?: string;
  created_at_to?: string;
  [key: string]: unknown;
}

export const protocolsApi = {
  getProtocols: async (
    page: number,
    pageSize: number,
    filters?: ProtocolFilters,
    sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' },
    laboratoryId?: number,
    departmentId?: number
  ): Promise<PaginatedResponse<Protocol>> => {
    const params: Record<string, unknown> = {
      page,
      page_size: pageSize,
    };

    if (laboratoryId) {
      params.laboratory_id = laboratoryId;
    }

    if (departmentId) {
      params.department_id = departmentId;
    }

    if (filters?.test_protocol_number) {
      params.search = filters.test_protocol_number;
    }

    if (filters?.sampling_act_number) {
      params.search_sampling_act = filters.sampling_act_number;
    }

    if (filters?.search_samples) {
      params.search_samples = filters.search_samples;
    }

    if (filters?.is_accredited !== undefined && filters?.is_accredited !== null) {
      params.is_accredited = filters.is_accredited;
    }

    if (filters?.test_protocol_date_from) {
      params.test_protocol_date_from = filters.test_protocol_date_from;
    }
    if (filters?.test_protocol_date_to) {
      params.test_protocol_date_to = filters.test_protocol_date_to;
    }
    if (filters?.test_protocol_date_search) {
      params.search_date = filters.test_protocol_date_search;
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

    const response = await axiosInstance.get<PaginatedResponse<Protocol>>('/api/protocols/', {
      params,
    });
    return response.data;
  },

  getProtocol: async (id: number): Promise<Protocol> => {
    const response = await axiosInstance.get<Protocol>(`/api/protocols/${id}/`);
    return response.data;
  },

  createProtocol: async (data: ProtocolCreate): Promise<Protocol> => {
    const response = await axiosInstance.post<Protocol>('/api/protocols/', data);
    return response.data;
  },

  updateProtocol: async (id: number, data: ProtocolUpdate): Promise<Protocol> => {
    const response = await axiosInstance.patch<Protocol>(`/api/protocols/${id}/`, data);
    return response.data;
  },

  deleteProtocol: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/protocols/${id}/`);
  },

  generateProtocolExcel: async (protocolId: number): Promise<Blob> => {
    try {
      const response = await axiosInstance.get(`/api/protocols/${protocolId}/generate-excel/`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: Blob; status?: number } };
        if (
          axiosError.response?.data &&
          axiosError.response.status &&
          axiosError.response.status >= 400
        ) {
          const blob = axiosError.response.data;
          try {
            const text = await blob.text();
            const json = JSON.parse(text);
            if (json.detail) {
              throw new Error(json.detail);
            }
          } catch {
            throw error;
          }
        }
      }
      throw error;
    }
  },

  getAvailableProtocolTemplates: async (
    laboratoryId: number,
    departmentId?: number
  ): Promise<ProtocolTemplate[]> => {
    const params: Record<string, unknown> = {
      laboratory_id: laboratoryId,
    };
    if (departmentId) {
      params.department_id = departmentId;
    }
    const response = await axiosInstance.get<ProtocolTemplate[]>(
      '/api/protocol-templates/available/',
      { params }
    );
    return response.data;
  },
};

export interface ProtocolTemplate {
  id: number;
  name: string;
  file_name: string;
  version: string;
  accreditation_header_row?: number;
  laboratory_id: number;
  department_id?: number;
  laboratory_name?: string;
  department_name?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}
