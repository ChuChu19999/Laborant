import { axiosInstance } from '../config/axios';

export const employeesApi = {
  // Поиск сотрудников по части ФИО (не менее 3 символов)
  searchByFio: async (searchFio: string, includePhoto: boolean = true) => {
    if (!searchFio || searchFio.length < 3) {
      return [];
    }

    const response = await axiosInstance.get('/api/employees/search/', {
      params: { searchFio, includePhoto },
    });

    return response.data;
  },

  // Получение ФИО по hashMd5
  getByHash: async (hash: string, includePhoto: boolean = true) => {
    if (!hash) return null;

    const response = await axiosInstance.get(`/api/employees/${hash}/`, {
      params: { include_photo: includePhoto },
    });
    return response.data;
  },

  searchByFioAndLaboratory: async (searchFio: string, laboratoryName: string) => {
    if (!searchFio || searchFio.length < 3) {
      return [];
    }

    const response = await axiosInstance.get('/api/employees/search/', {
      params: { searchFio, laboratoryName, includePhoto: true },
    });

    return response.data;
  },

  getLaboratoryById: async (id: number) => {
    const response = await axiosInstance.get(`/api/laboratories/${id}/`);
    return response.data;
  },
};
