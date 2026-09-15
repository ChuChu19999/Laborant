import { axiosInstance } from '@/shared/config';
import { filenameFromAxiosHeaders, type PaginatedResponse } from '@/shared/lib/http';
import type { Sample } from '@/entities/Sample/@x/Protocol';

export interface Protocol {
  id: number;
  test_protocol_number?: string;
  test_protocol_date?: string;
  is_accredited: boolean;
  sampling_act_number: string;
  sampling_act_date?: string | null;
  sampling_request_number?: string | null;
  sampling_request_date?: string | null;
  sampling_method_nd?: string | null;
  sampling_plan_number?: string | null;
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
  formatted_protocol_number?: string;
  has_undeleted_calculations?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/** Данные для создания протокола. */
export interface ProtocolCreate {
  test_protocol_number?: string;
  test_protocol_date?: string;
  is_accredited?: boolean;
  sampling_act_number: string;
  sampling_act_date?: string | null;
  sampling_request_number?: string | null;
  sampling_request_date?: string | null;
  sampling_method_nd?: string | null;
  sampling_plan_number?: string | null;
  issued?: string;
  approved?: string;
  issued_position?: string;
  approved_position?: string;
  protocol_template_id?: number;
  laboratory_id: number;
  department_id?: number;
  samples?: number[];
}

/** Данные для обновления протокола. */
export interface ProtocolUpdate {
  test_protocol_number?: string;
  test_protocol_date?: string;
  is_accredited?: boolean;
  sampling_act_number?: string;
  sampling_act_date?: string | null;
  sampling_request_number?: string | null;
  sampling_request_date?: string | null;
  sampling_method_nd?: string | null;
  sampling_plan_number?: string | null;
  issued?: string;
  approved?: string;
  issued_position?: string;
  approved_position?: string;
  protocol_template_id?: number;
  laboratory_id?: number;
  department_id?: number;
  samples?: number[];
}

/** Фильтры списка протоколов. */
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

/** Шаблон протокола. */
export interface ProtocolTemplate {
  id: number;
  name: string;
  file_name: string;
  version: string;
  laboratory_id: number;
  department_id?: number;
  laboratory_name?: string;
  department_name?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/** Стиль ячейки Excel. */
export interface CellStyle {
  fontWeight?: string;
  fontStyle?: string;
  fontSize?: string;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
}

/** API протоколов. */
export const protocolsApi = {
  getProtocols: async (
    page?: number,
    pageSize?: number,
    filters?: ProtocolFilters,
    sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' },
    laboratoryId?: number,
    departmentId?: number
  ): Promise<PaginatedResponse<Protocol>> => {
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

  generateProtocolExcel: async (protocolId: number): Promise<{ blob: Blob; filename: string }> => {
    try {
      const response = await axiosInstance.get<Blob>(
        `/api/protocols/${protocolId}/generate-excel/`,
        {
          responseType: 'blob',
        }
      );

      const filename = filenameFromAxiosHeaders(response.headers, `protocol_${protocolId}.xlsx`);
      return { blob: response.data, filename };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: Blob; status?: number } };
        if (
          axiosError.response?.data &&
          axiosError.response.status &&
          axiosError.response.status >= 400
        ) {
          const blob = axiosError.response.data;
          let detail: string | undefined;
          try {
            const text = await blob.text();
            const json: unknown = JSON.parse(text);
            if (
              typeof json === 'object' &&
              json !== null &&
              'detail' in json &&
              typeof json.detail === 'string'
            ) {
              detail = (json as { detail: string }).detail;
            }
          } catch {
            // Ignore parse errors; rethrow original axios error below.
          }
          if (detail) {
            throw new Error(detail);
          }
          throw error;
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

  getProtocolTemplates: async (
    laboratoryId?: number,
    departmentId?: number,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<ProtocolTemplate>> => {
    const params: Record<string, unknown> = {};
    if (laboratoryId) {
      params.laboratory_id = laboratoryId;
    }
    if (departmentId) {
      params.department_id = departmentId;
    }
    if (page !== undefined) {
      params.page = page;
    }
    if (pageSize !== undefined) {
      params.page_size = pageSize;
    }
    const response = await axiosInstance.get<PaginatedResponse<ProtocolTemplate>>(
      '/api/protocol-templates/',
      { params }
    );
    return response.data;
  },

  getProtocolTemplate: async (id: number): Promise<ProtocolTemplate> => {
    const response = await axiosInstance.get<ProtocolTemplate>(`/api/protocol-templates/${id}/`);
    return response.data;
  },

  createProtocolTemplate: async (data: {
    name: string;
    file_name: string;
    file: string;
    laboratory_id: number;
    department_id?: number;
  }): Promise<ProtocolTemplate> => {
    const response = await axiosInstance.post<ProtocolTemplate>('/api/protocol-templates/', data);
    return response.data;
  },

  updateProtocolTemplate: async (
    id: number,
    data: Partial<ProtocolTemplate> & { file?: string }
  ): Promise<ProtocolTemplate> => {
    const response = await axiosInstance.patch<ProtocolTemplate>(
      `/api/protocol-templates/${id}/`,
      data
    );
    return response.data;
  },

  saveExcelSection: async (
    formData: FormData
  ): Promise<{ template_id?: number; error?: string }> => {
    const response = await axiosInstance.post<{ template_id?: number; error?: string }>(
      '/api/save-excel/',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  getExcelStyles: async (
    templateId: number,
    section: string
  ): Promise<{ styles?: Record<string, CellStyle> }> => {
    const response = await axiosInstance.get<{
      styles?: Record<string, CellStyle>;
    }>('/api/get-excel-styles/', {
      params: {
        template_id: templateId,
        section: section,
      },
    });
    return response.data;
  },

  getProtocolTemplateFile: async (templateId: number, section: string): Promise<ArrayBuffer> => {
    const response = await axiosInstance.get<ArrayBuffer>(
      `/api/protocol-templates/${templateId}/`,
      {
        params: {
          download: true,
          section: section,
        },
        responseType: 'arraybuffer',
      }
    );
    return response.data;
  },
};
