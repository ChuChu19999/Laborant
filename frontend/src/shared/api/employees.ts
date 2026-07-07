import { axiosInstance } from '../config/axios';

export interface EmployeeBrief {
  hsnils: string;
  fullName: string;
}

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

  // Поиск сотрудников по ФИО с фильтрацией по лаборатории
  searchByFioAndLaboratory: async (
    searchFio: string,
    laboratoryName: string,
    includePhoto: boolean = true
  ) => {
    if (!searchFio || searchFio.length < 3) {
      return [];
    }

    if (!laboratoryName) {
      console.warn('Название лаборатории не указано, возвращаем пустой результат');
      return [];
    }

    try {
      const response = await axiosInstance.get('/api/employees/search-by-laboratory/', {
        params: {
          searchFio,
          laboratoryName,
          includePhoto,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Ошибка при поиске сотрудников:', error);
      throw error;
    }
  },

  // Получение ФИО по hsnils
  getByHsnils: async (hsnils: string, includePhoto: boolean = true) => {
    if (!hsnils) return null;

    const response = await axiosInstance.get(`/api/employees/${hsnils}/`, {
      params: { includePhoto },
    });
    return response.data;
  },

  // Получение информации о сотрудниках по массиву hsnils (батч-запрос)
  getByHsnilsList: async (hsnilsList: string[], includePhoto: boolean = false) => {
    if (!hsnilsList || hsnilsList.length === 0) {
      return {};
    }

    const response = await axiosInstance.post<Record<string, EmployeeBrief>>(
      '/api/employees/by-hsnils/',
      {
        hsnils: hsnilsList,
        includePhoto,
      }
    );
    return response.data;
  },
};
