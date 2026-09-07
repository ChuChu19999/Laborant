import { axiosInstance } from '@/shared/config';
import { normalizeFioSearch } from '@/shared/lib/formatting';

/** Фотография сотрудника. */
export interface EmployeePhoto {
  photoWebp50?: string | null;
  photoWebp50sha256?: string;
  photoWebp300?: string | null;
  photoJpg300sha256?: string;
  photoWebp200?: string | null;
  photoWebp200Sha256?: string;
}

/** Краткие данные сотрудника. */
export interface EmployeeBrief {
  hsnils: string;
  fullName: string;
  employeePhoto?: EmployeePhoto | null;
  jobTitle?: string;
  [key: string]: unknown;
}

/** Сотрудник для выбора в формах и пикерах. */
export type Employee = EmployeeBrief;

/** API сотрудников. */
export const employeesApi = {
  /** Поиск сотрудников по части ФИО (не менее 3 символов). */
  searchByFio: async (
    searchFio: string,
    includePhoto: boolean = true
  ): Promise<EmployeeBrief[]> => {
    const normalized = normalizeFioSearch(searchFio);
    if (!normalized || normalized.length < 3) {
      return [];
    }

    const response = await axiosInstance.get<EmployeeBrief[]>('/api/employees/search/', {
      params: { searchFio: normalized, includePhoto },
    });

    return response.data;
  },

  /** Поиск сотрудников по ФИО с фильтрацией по лаборатории. */
  searchByFioAndLaboratory: async (
    searchFio: string,
    laboratoryName: string,
    includePhoto: boolean = true
  ): Promise<EmployeeBrief[]> => {
    const normalized = normalizeFioSearch(searchFio);
    if (!normalized || normalized.length < 3) {
      return [];
    }

    if (!laboratoryName) {
      return [];
    }

    const response = await axiosInstance.get<EmployeeBrief[]>(
      '/api/employees/search-by-laboratory/',
      {
        params: {
          searchFio: normalized,
          laboratoryName,
          includePhoto,
        },
      }
    );

    return response.data;
  },

  /** Получение ФИО по hsnils. */
  getByHsnils: async (
    hsnils: string,
    includePhoto: boolean = true
  ): Promise<EmployeeBrief | null> => {
    if (!hsnils) return null;

    const response = await axiosInstance.get<EmployeeBrief>(`/api/employees/${hsnils}/`, {
      params: { includePhoto },
    });
    return response.data;
  },

  /** Получение информации о сотрудниках по массиву hsnils (батч-запрос). */
  getByHsnilsList: async (
    hsnilsList: string[],
    includePhoto: boolean = false
  ): Promise<Record<string, EmployeeBrief>> => {
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
