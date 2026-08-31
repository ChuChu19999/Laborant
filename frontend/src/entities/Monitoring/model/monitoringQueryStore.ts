import { create } from 'zustand';
import { logger } from '@/shared/lib/zustand';
import type { MonitoringErrorFilters } from '../api';
import type { QueryState } from '@/shared/lib/zustand';

/** Состояние пагинации и фильтров списка ошибок мониторинга. */
export interface MonitoringQueryState extends QueryState {
  filters?: MonitoringErrorFilters;
}

interface MonitoringQueryStore {
  monitoringQuery: MonitoringQueryState;
  setMonitoringPage: (page: number) => void;
  setMonitoringPageSize: (pageSize: number) => void;
  setMonitoringFilters: (filters: MonitoringQueryState['filters']) => void;
  setMonitoringSorting: (sorting: MonitoringQueryState['sorting']) => void;
  resetMonitoringQuery: () => void;
}

const defaultQueryState: MonitoringQueryState = {
  page: 1,
  pageSize: 20,
  filters: { period: '24h' },
};

/** Zustand-хранилище параметров запроса списка ошибок мониторинга. */
export const useMonitoringQueryStore = create<MonitoringQueryStore>()(
  logger(set => ({
    monitoringQuery: { ...defaultQueryState },
    setMonitoringPage: page =>
      set(state => ({
        monitoringQuery: { ...state.monitoringQuery, page },
      })),
    setMonitoringPageSize: pageSize =>
      set(state => ({
        monitoringQuery: { ...state.monitoringQuery, pageSize, page: 1 },
      })),
    setMonitoringFilters: filters =>
      set(state => ({
        monitoringQuery: { ...state.monitoringQuery, filters, page: 1 },
      })),
    setMonitoringSorting: sorting =>
      set(state => ({
        monitoringQuery: { ...state.monitoringQuery, sorting, page: 1 },
      })),
    resetMonitoringQuery: () =>
      set({
        monitoringQuery: { ...defaultQueryState },
      }),
  }))
);
