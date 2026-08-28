import { create } from 'zustand';
import { logger } from '@/shared/lib/zustand';
import type { QueryState } from '@/shared/lib/zustand';

/** Состояние пагинации, фильтров и области видимости списка проб. */
export interface SamplesQueryState extends QueryState {
  laboratoryId?: number;
  departmentId?: number;
  filters?: {
    registration_number?: string;
    test_object?: string;
    sampling_date_from?: string;
    sampling_date_to?: string;
    receiving_date_from?: string;
    receiving_date_to?: string;
    created_at_from?: string;
    created_at_to?: string;
  };
}

interface SamplesQueryStore {
  samplesQuery: SamplesQueryState;
  setSamplesPage: (page: number) => void;
  setSamplesPageSize: (pageSize: number) => void;
  setSamplesFilters: (filters: SamplesQueryState['filters']) => void;
  setSamplesSorting: (sorting: SamplesQueryState['sorting']) => void;
  setSamplesLaboratoryId: (laboratoryId: number | undefined) => void;
  setSamplesDepartmentId: (departmentId: number | undefined) => void;
  resetSamplesQuery: () => void;
}

const defaultQueryState: QueryState = {
  page: 1,
  pageSize: 20,
};

/** Zustand-хранилище параметров запроса списка проб. */
export const useSamplesQueryStore = create<SamplesQueryStore>()(
  logger(set => ({
    samplesQuery: { ...defaultQueryState },
    setSamplesPage: page =>
      set(state => ({
        samplesQuery: { ...state.samplesQuery, page },
      })),
    setSamplesPageSize: pageSize =>
      set(state => ({
        samplesQuery: { ...state.samplesQuery, pageSize, page: 1 },
      })),
    setSamplesFilters: filters =>
      set(state => ({
        samplesQuery: { ...state.samplesQuery, filters, page: 1 },
      })),
    setSamplesSorting: sorting =>
      set(state => ({
        samplesQuery: { ...state.samplesQuery, sorting, page: 1 },
      })),
    setSamplesLaboratoryId: laboratoryId =>
      set(state => ({
        samplesQuery: { ...state.samplesQuery, laboratoryId, page: 1 },
      })),
    setSamplesDepartmentId: departmentId =>
      set(state => ({
        samplesQuery: { ...state.samplesQuery, departmentId, page: 1 },
      })),
    resetSamplesQuery: () =>
      set({
        samplesQuery: { ...defaultQueryState },
      }),
  }))
);
