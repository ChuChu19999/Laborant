import { create } from 'zustand';
import { logger } from '@/shared/lib/zustand';
import type { QueryState } from '@/shared/lib/zustand';

/** Состояние пагинации, фильтров и области видимости списка методик. */
export interface ResearchMethodsQueryState extends QueryState {
  laboratoryId?: number;
  departmentId?: number;
  filters?: {
    search?: string;
    rounding_type?: string;
  };
}

interface ResearchMethodsQueryStore {
  researchMethodsQuery: ResearchMethodsQueryState;
  setResearchMethodsPage: (page: number) => void;
  setResearchMethodsPageSize: (pageSize: number) => void;
  setResearchMethodsFilters: (filters: ResearchMethodsQueryState['filters']) => void;
  setResearchMethodsSorting: (sorting: ResearchMethodsQueryState['sorting']) => void;
  setResearchMethodsLaboratoryId: (laboratoryId: number | undefined) => void;
  setResearchMethodsDepartmentId: (departmentId: number | undefined) => void;
  resetResearchMethodsQuery: () => void;
}

const defaultQueryState: QueryState = {
  page: 1,
  pageSize: 20,
};

/** Zustand-хранилище параметров запроса списка методик. */
export const useResearchMethodsQueryStore = create<ResearchMethodsQueryStore>()(
  logger(set => ({
    researchMethodsQuery: { ...defaultQueryState },
    setResearchMethodsPage: page =>
      set(state => ({
        researchMethodsQuery: { ...state.researchMethodsQuery, page },
      })),
    setResearchMethodsPageSize: pageSize =>
      set(state =>
        state.researchMethodsQuery.pageSize === pageSize
          ? state
          : {
              researchMethodsQuery: { ...state.researchMethodsQuery, pageSize, page: 1 },
            }
      ),
    setResearchMethodsFilters: filters =>
      set(state => ({
        researchMethodsQuery: { ...state.researchMethodsQuery, filters, page: 1 },
      })),
    setResearchMethodsSorting: sorting =>
      set(state => {
        const prev = state.researchMethodsQuery.sorting;
        if (prev?.sort_by === sorting?.sort_by && prev?.sort_order === sorting?.sort_order) {
          return state;
        }
        return {
          researchMethodsQuery: { ...state.researchMethodsQuery, sorting, page: 1 },
        };
      }),
    setResearchMethodsLaboratoryId: laboratoryId =>
      set(state =>
        state.researchMethodsQuery.laboratoryId === laboratoryId
          ? state
          : {
              researchMethodsQuery: { ...state.researchMethodsQuery, laboratoryId, page: 1 },
            }
      ),
    setResearchMethodsDepartmentId: departmentId =>
      set(state =>
        state.researchMethodsQuery.departmentId === departmentId
          ? state
          : {
              researchMethodsQuery: { ...state.researchMethodsQuery, departmentId, page: 1 },
            }
      ),
    resetResearchMethodsQuery: () =>
      set({
        researchMethodsQuery: { ...defaultQueryState },
      }),
  }))
);
