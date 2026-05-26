import { axiosInstance } from '../config/axios';
import type { PaginatedResponse } from './research';

export const REPORT_TYPES = [
  'Количество проб',
  'Физико-химическая характеристика',
  'Результаты КГС',
  'Результаты НКС',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export interface ReportTemplate {
  id: number;
  report_type: string;
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

export interface ReportTemplateCreate {
  report_type: string;
  file_name: string;
  file: string;
  laboratory_id: number;
  department_id?: number;
}

export interface ReportTemplateUpdate {
  report_type?: string;
  file?: string;
  file_name?: string;
}

export const reportsApi = {
  getReportTemplates: async (
    laboratoryId?: number,
    departmentId?: number,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<ReportTemplate>> => {
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
    const response = await axiosInstance.get<PaginatedResponse<ReportTemplate>>(
      '/api/report-templates/',
      { params }
    );
    return response.data;
  },

  getAvailableReportTemplates: async (
    laboratoryId: number,
    departmentId?: number
  ): Promise<ReportTemplate[]> => {
    const params: Record<string, unknown> = {
      laboratory_id: laboratoryId,
    };
    if (departmentId) {
      params.department_id = departmentId;
    }
    const response = await axiosInstance.get<ReportTemplate[]>('/api/report-templates/available/', {
      params,
    });
    return response.data;
  },

  getReportTemplate: async (id: number): Promise<ReportTemplate> => {
    const response = await axiosInstance.get<ReportTemplate>(`/api/report-templates/${id}/`);
    return response.data;
  },

  createReportTemplate: async (data: ReportTemplateCreate): Promise<ReportTemplate> => {
    const response = await axiosInstance.post<ReportTemplate>('/api/report-templates/', data);
    return response.data;
  },

  updateReportTemplate: async (id: number, data: ReportTemplateUpdate): Promise<ReportTemplate> => {
    const response = await axiosInstance.patch<ReportTemplate>(
      `/api/report-templates/${id}/`,
      data
    );
    return response.data;
  },

  deleteReportTemplate: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/report-templates/${id}/`);
  },

  getReportTemplateFile: async (templateId: number): Promise<Blob> => {
    const response = await axiosInstance.get(`/api/report-templates/${templateId}/`, {
      params: {
        download: true,
      },
      responseType: 'blob',
    });
    return response.data;
  },

  generateSampleCountReport: async (params: {
    laboratory_id: number;
    department_id?: number;
    template_id?: number;
    date_from: string;
    date_to: string;
  }): Promise<{ blob: Blob; filename: string }> => {
    const response = await axiosInstance.post(
      '/api/report-templates/generate/sample-count/',
      params,
      { responseType: 'blob' }
    );
    let filename = `Количество_проб_${params.date_from}_${params.date_to}.zip`;
    const contentDisposition =
      response.headers['content-disposition'] || response.headers['Content-Disposition'] || '';
    const utf8NameMatch = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    const basicNameMatch = contentDisposition.match(/filename\s*=\s*"?([^"]+)"?/i);
    const rawName = utf8NameMatch?.[1] ?? basicNameMatch?.[1];
    if (rawName) {
      try {
        filename = decodeURIComponent(rawName);
      } catch {
        filename = rawName;
      }
    }
    return { blob: response.data, filename };
  },

  generatePhysicochemicalReport: async (params: {
    laboratory_id: number;
    department_id?: number;
    template_id?: number;
    date_from: string;
    date_to: string;
    sampling_location: string;
  }): Promise<{ blob: Blob; filename: string }> => {
    const response = await axiosInstance.post(
      '/api/report-templates/generate/physicochemical-characteristic/',
      params,
      { responseType: 'blob' }
    );
    let filename = `Физико_химическая_характеристика_${params.sampling_location}_${params.date_from}_${params.date_to}.xlsx`;
    const contentDisposition =
      response.headers['content-disposition'] || response.headers['Content-Disposition'] || '';
    const utf8NameMatch = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    const basicNameMatch = contentDisposition.match(/filename\s*=\s*"?([^"]+)"?/i);
    const rawName = utf8NameMatch?.[1] ?? basicNameMatch?.[1];
    if (rawName) {
      try {
        filename = decodeURIComponent(rawName);
      } catch {
        filename = rawName;
      }
    }
    return { blob: response.data, filename };
  },

  generateNksReport: async (params: {
    laboratory_id: number;
    department_id?: number;
    template_id?: number;
    date_from: string;
    date_to: string;
  }): Promise<{ blob: Blob; filename: string }> => {
    const response = await axiosInstance.post(
      '/api/report-templates/generate/nks-results/',
      params,
      { responseType: 'blob' }
    );
    let filename = `Результаты_НКС_${params.date_from}_${params.date_to}.xlsx`;
    const contentDisposition =
      response.headers['content-disposition'] || response.headers['Content-Disposition'] || '';
    const utf8NameMatch = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    const basicNameMatch = contentDisposition.match(/filename\s*=\s*"?([^"]+)"?/i);
    const rawName = utf8NameMatch?.[1] ?? basicNameMatch?.[1];
    if (rawName) {
      try {
        filename = decodeURIComponent(rawName);
      } catch {
        filename = rawName;
      }
    }
    return { blob: response.data, filename };
  },

  generateKgsReport: async (params: {
    laboratory_id: number;
    department_id?: number;
    template_id?: number;
    date_from: string;
    date_to: string;
  }): Promise<{ blob: Blob; filename: string }> => {
    const response = await axiosInstance.post(
      '/api/report-templates/generate/kgs-results/',
      params,
      { responseType: 'blob' }
    );
    let filename = `Результаты_КГС_${params.date_from}_${params.date_to}.xlsx`;
    const contentDisposition =
      response.headers['content-disposition'] || response.headers['Content-Disposition'] || '';
    const utf8NameMatch = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    const basicNameMatch = contentDisposition.match(/filename\s*=\s*"?([^"]+)"?/i);
    const rawName = utf8NameMatch?.[1] ?? basicNameMatch?.[1];
    if (rawName) {
      try {
        filename = decodeURIComponent(rawName);
      } catch {
        filename = rawName;
      }
    }
    return { blob: response.data, filename };
  },
};
