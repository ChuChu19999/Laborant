import { create } from 'zustand';
import { logger } from '@/shared/lib/zustand';
import type { QueryState } from '@/shared/lib/zustand';

/** Состояние пагинации, фильтров и области видимости списка норм НД. */
export interface NdNormsQueryState extends QueryState {
  laboratoryId?: number;
  departmentId?: number;
  filters?: {
    name?: string;
    created_at_from?: string;
    created_at_to?: string;
  };
}

interface NdNormsQueryStore {
  ndNormsQuery: NdNormsQueryState;
  setNdNormsPage: (page: number) => void;
  setNdNormsPageSize: (pageSize: number) => void;
  setNdNormsFilters: (filters: NdNormsQueryState['filters']) => void;
  setNdNormsSorting: (sorting: NdNormsQueryState['sorting']) => void;
  setNdNormsLaboratoryId: (laboratoryId: number | undefined) => void;
  setNdNormsDepartmentId: (departmentId: number | undefined) => void;
  resetNdNormsQuery: () => void;
}

const defaultQueryState: QueryState = {
  page: 1,
  pageSize: 20,
};

/** Zustand-хранилище параметров запроса списка норм НД. */
export const useNdNormsQueryStore = create<NdNormsQueryStore>()(
  logger(set => ({
    ndNormsQuery: { ...defaultQueryState },
    setNdNormsPage: page =>
      set(state => ({
        ndNormsQuery: { ...state.ndNormsQuery, page },
      })),
    setNdNormsPageSize: pageSize =>
      set(state => ({
        ndNormsQuery: { ...state.ndNormsQuery, pageSize, page: 1 },
      })),
    setNdNormsFilters: filters =>
      set(state => ({
        ndNormsQuery: { ...state.ndNormsQuery, filters, page: 1 },
      })),
    setNdNormsSorting: sorting =>
      set(state => ({
        ndNormsQuery: { ...state.ndNormsQuery, sorting, page: 1 },
      })),
    setNdNormsLaboratoryId: laboratoryId =>
      set(state => ({
        ndNormsQuery: { ...state.ndNormsQuery, laboratoryId, page: 1 },
      })),
    setNdNormsDepartmentId: departmentId =>
      set(state => ({
        ndNormsQuery: { ...state.ndNormsQuery, departmentId, page: 1 },
      })),
    resetNdNormsQuery: () =>
      set({
        ndNormsQuery: { ...defaultQueryState },
      }),
  }))
);
