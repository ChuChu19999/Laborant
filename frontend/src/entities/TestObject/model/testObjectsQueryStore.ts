import { create } from 'zustand';
import { logger } from '@/shared/lib/zustand';
import type { QueryState } from '@/shared/lib/zustand';

/** Состояние пагинации и фильтров списка объектов испытаний. */
export interface TestObjectsQueryState extends QueryState {
  filters?: {
    search?: string;
    name?: string;
    tag?: string;
  };
}

interface TestObjectsQueryStore {
  testObjectsQuery: TestObjectsQueryState;
  setTestObjectsPage: (page: number) => void;
  setTestObjectsPageSize: (pageSize: number) => void;
  setTestObjectsFilters: (filters: TestObjectsQueryState['filters']) => void;
  setTestObjectsSorting: (sorting: TestObjectsQueryState['sorting']) => void;
  resetTestObjectsQuery: () => void;
}

const defaultQueryState: QueryState = {
  page: 1,
  pageSize: 20,
};

/** Zustand-хранилище параметров запроса списка объектов испытаний. */
export const useTestObjectsQueryStore = create<TestObjectsQueryStore>()(
  logger(set => ({
    testObjectsQuery: { ...defaultQueryState },
    setTestObjectsPage: page =>
      set(state => ({
        testObjectsQuery: { ...state.testObjectsQuery, page },
      })),
    setTestObjectsPageSize: pageSize =>
      set(state => ({
        testObjectsQuery: { ...state.testObjectsQuery, pageSize, page: 1 },
      })),
    setTestObjectsFilters: filters =>
      set(state => ({
        testObjectsQuery: { ...state.testObjectsQuery, filters, page: 1 },
      })),
    setTestObjectsSorting: sorting =>
      set(state => ({
        testObjectsQuery: { ...state.testObjectsQuery, sorting, page: 1 },
      })),
    resetTestObjectsQuery: () =>
      set({
        testObjectsQuery: { ...defaultQueryState },
      }),
  }))
);
