import { axiosInstance } from '../config/axios';

export interface Laboratory {
  id: number;
  name: string;
  full_name: string;
  laboratory_location?: string;
  departments_count?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Department {
  id: number;
  name: string;
  laboratory_id: number;
  laboratory_name?: string;
  laboratory_location: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface LaboratoryCreate {
  name: string;
  full_name: string;
  laboratory_location?: string;
}

export interface LaboratoryUpdate {
  name?: string;
  full_name?: string;
  laboratory_location?: string;
}

export interface DepartmentCreate {
  name: string;
  laboratory_id: number;
  laboratory_location: string;
}

export interface DepartmentUpdate {
  name?: string;
  laboratory_location?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const laboratoriesApi = {
  getLaboratories: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    sort_by?: string;
    sort_order?: string;
  }): Promise<PaginatedResponse<Laboratory>> => {
    const response = await axiosInstance.get('/api/laboratories/', { params });
    return response.data;
  },

  getLaboratory: async (id: number): Promise<Laboratory> => {
    const response = await axiosInstance.get(`/api/laboratories/${id}/`);
    return response.data;
  },

  createLaboratory: async (data: LaboratoryCreate): Promise<Laboratory> => {
    const response = await axiosInstance.post('/api/laboratories/', data);
    return response.data;
  },

  updateLaboratory: async (id: number, data: LaboratoryUpdate): Promise<Laboratory> => {
    const response = await axiosInstance.patch(`/api/laboratories/${id}/`, data);
    return response.data;
  },

  deleteLaboratory: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/laboratories/${id}/`);
  },

  getDepartments: async (params?: {
    laboratory_id?: number;
    page?: number;
    page_size?: number;
    search?: string;
    sort_by?: string;
    sort_order?: string;
  }): Promise<PaginatedResponse<Department>> => {
    const response = await axiosInstance.get('/api/departments/', { params });
    return response.data;
  },

  getDepartmentsByLaboratory: async (laboratoryId: number): Promise<Department[]> => {
    const response = await axiosInstance.get('/api/departments/by-laboratory/', {
      params: { laboratory_id: laboratoryId },
    });
    return response.data;
  },

  getDepartment: async (id: number): Promise<Department> => {
    const response = await axiosInstance.get(`/api/departments/${id}/`);
    return response.data;
  },

  createDepartment: async (data: DepartmentCreate): Promise<Department> => {
    const response = await axiosInstance.post('/api/departments/', data);
    return response.data;
  },

  updateDepartment: async (id: number, data: DepartmentUpdate): Promise<Department> => {
    const response = await axiosInstance.patch(`/api/departments/${id}/`, data);
    return response.data;
  },

  deleteDepartment: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/api/departments/${id}/`);
  },
};
