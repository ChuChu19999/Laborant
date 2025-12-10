import { create } from 'zustand';
import { logger } from '../../lib/zustand/middleware';
import type { QueryState } from '../../lib/zustand/types';

/**
 * Интерфейс для параметров запросов методов исследования
 */
export interface ResearchMethodsQueryState extends QueryState {
  laboratoryId?: number;
  departmentId?: number;
  filters?: {
    search?: string;
    rounding_type?: string;
  };
}

interface QueryStore {
  researchMethodsQuery: ResearchMethodsQueryState;
  setResearchMethodsPage: (page: number) => void;
  setResearchMethodsPageSize: (pageSize: number) => void;
  setResearchMethodsFilters: (filters: ResearchMethodsQueryState['filters']) => void;
  setResearchMethodsSorting: (sorting: ResearchMethodsQueryState['sorting']) => void;
  setResearchMethodsLaboratoryId: (laboratoryId: number | undefined) => void;
  setResearchMethodsDepartmentId: (departmentId: number | undefined) => void;
  resetResearchMethodsQuery: () => void;
  resetAllQueries: () => void;
}

/**
 * Дефолтное состояние для query параметров
 */
const defaultQueryState: QueryState = {
  page: 1,
  pageSize: 20,
};

/**
 * Query Store - управление параметрами запросов
 * Использует logger middleware для логирования изменений в режиме разработки
 */
export const useQueryStore = create<QueryStore>()(
  logger(set => ({
    researchMethodsQuery: { ...defaultQueryState },
    setResearchMethodsPage: page =>
      set(state => ({
        researchMethodsQuery: { ...state.researchMethodsQuery, page },
      })),
    setResearchMethodsPageSize: pageSize =>
      set(state => ({
        researchMethodsQuery: { ...state.researchMethodsQuery, pageSize, page: 1 },
      })),
    setResearchMethodsFilters: filters =>
      set(state => ({
        researchMethodsQuery: { ...state.researchMethodsQuery, filters, page: 1 },
      })),
    setResearchMethodsSorting: sorting =>
      set(state => ({
        researchMethodsQuery: { ...state.researchMethodsQuery, sorting, page: 1 },
      })),
    setResearchMethodsLaboratoryId: laboratoryId =>
      set(state => ({
        researchMethodsQuery: { ...state.researchMethodsQuery, laboratoryId, page: 1 },
      })),
    setResearchMethodsDepartmentId: departmentId =>
      set(state => ({
        researchMethodsQuery: { ...state.researchMethodsQuery, departmentId, page: 1 },
      })),
    resetResearchMethodsQuery: () =>
      set({
        researchMethodsQuery: { ...defaultQueryState },
      }),
    resetAllQueries: () =>
      set({
        researchMethodsQuery: { ...defaultQueryState },
      }),
  }))
);
