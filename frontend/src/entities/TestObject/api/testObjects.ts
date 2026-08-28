import { axiosInstance } from '@/shared/config';
import type { VisibilityScope } from '@/entities/Role/@x/TestObject';
import type { PaginatedResponse } from '@/shared/lib/http';

export interface TestObjectCatalogItem {
  id: number;
  name: string;
  tag: string;
  protocol_abbreviation?: string | null;
  visibility_scope: VisibilityScope;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/** Объект испытаний для селекта. */
export interface TestObjectSelectItem {
  name: string;
  tag: string;
}

/** Данные для создания объекта испытаний. */
export interface TestObjectCreate {
  name: string;
  tag: string;
  protocol_abbreviation?: string | null;
  visibility_scope: VisibilityScope;
}

/** Данные для обновления объекта испытаний. */
export interface TestObjectUpdate {
  name?: string;
  tag?: string;
  protocol_abbreviation?: string | null;
  visibility_scope?: VisibilityScope;
}

/** Фильтры списка объектов испытаний. */
export interface TestObjectFilters {
  search?: string;
  name?: string;
  tag?: string;
  [key: string]: unknown;
}

/** API объектов испытаний. */
export const testObjectsApi = {
  getTestObjects: async (
    page?: number,
    pageSize?: number,
    filters?: TestObjectFilters,
    sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' }
  ): Promise<PaginatedResponse<TestObjectCatalogItem>> => {
    const params: Record<string, unknown> = {};

    if (page !== undefined) {
      params.page = page;
    }

    if (pageSize !== undefined) {
      params.page_size = pageSize;
    }

    if (filters?.search) {
      params.search = filters.search;
    }

    if (sorting?.sort_by) {
      params.sort_by = sorting.sort_by;
      params.sort_order = sorting.sort_order || 'asc';
    }

    const response = await axiosInstance.get<PaginatedResponse<TestObjectCatalogItem>>(
      '/api/test-objects/',
      { params }
    );
    return response.data;
  },

  getTestObjectsForSelect: async (
    laboratoryId?: number,
    departmentId?: number
  ): Promise<TestObjectSelectItem[]> => {
    const params: Record<string, number> = {};

    if (laboratoryId) {
      params.laboratory_id = laboratoryId;
    }

    if (departmentId) {
      params.department_id = departmentId;
    }

    const response = await axiosInstance.get<TestObjectSelectItem[]>('/api/test-objects/select/', {
      params,
    });
    return response.data;
  },

  getTestObjectNames: async (laboratoryId?: number, departmentId?: number): Promise<string[]> => {
    const params: Record<string, number> = {};

    if (laboratoryId) {
      params.laboratory_id = laboratoryId;
    }

    if (departmentId) {
      params.department_id = departmentId;
    }

    const response = await axiosInstance.get<string[]>('/api/test-objects/names/', {
      params,
    });
    return response.data;
  },

  getTestObjectById: async (id: number): Promise<TestObjectCatalogItem> => {
    const response = await axiosInstance.get<TestObjectCatalogItem>(`/api/test-objects/${id}/`);
    return response.data;
  },

  createTestObject: async (data: TestObjectCreate): Promise<TestObjectCatalogItem> => {
    const response = await axiosInstance.post<TestObjectCatalogItem>('/api/test-objects/', data);
    return response.data;
  },

  updateTestObject: async (id: number, data: TestObjectUpdate): Promise<TestObjectCatalogItem> => {
    const response = await axiosInstance.patch<TestObjectCatalogItem>(
      `/api/test-objects/${id}/`,
      data
    );
    return response.data;
  },

  deleteTestObject: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/test-objects/${id}/`);
  },
};
