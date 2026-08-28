import { create } from 'zustand';
import { logger } from '@/shared/lib/zustand';
import type { QueryState } from '@/shared/lib/zustand';

/** Состояние пагинации, фильтров и области видимости списка протоколов. */
export interface ProtocolsQueryState extends QueryState {
  laboratoryId?: number;
  departmentId?: number;
  filters?: {
    test_protocol_number?: string;
    sampling_act_number?: string;
    test_protocol_date_from?: string;
    test_protocol_date_to?: string;
    created_at_from?: string;
    created_at_to?: string;
  };
}

interface ProtocolsQueryStore {
  protocolsQuery: ProtocolsQueryState;
  setProtocolsPage: (page: number) => void;
  setProtocolsPageSize: (pageSize: number) => void;
  setProtocolsFilters: (filters: ProtocolsQueryState['filters']) => void;
  setProtocolsSorting: (sorting: ProtocolsQueryState['sorting']) => void;
  setProtocolsLaboratoryId: (laboratoryId: number | undefined) => void;
  setProtocolsDepartmentId: (departmentId: number | undefined) => void;
  resetProtocolsQuery: () => void;
}

const defaultQueryState: QueryState = {
  page: 1,
  pageSize: 20,
};

/** Zustand-хранилище параметров запроса списка протоколов. */
export const useProtocolsQueryStore = create<ProtocolsQueryStore>()(
  logger(set => ({
    protocolsQuery: { ...defaultQueryState },
    setProtocolsPage: page =>
      set(state => ({
        protocolsQuery: { ...state.protocolsQuery, page },
      })),
    setProtocolsPageSize: pageSize =>
      set(state => ({
        protocolsQuery: { ...state.protocolsQuery, pageSize, page: 1 },
      })),
    setProtocolsFilters: filters =>
      set(state => ({
        protocolsQuery: { ...state.protocolsQuery, filters, page: 1 },
      })),
    setProtocolsSorting: sorting =>
      set(state => ({
        protocolsQuery: { ...state.protocolsQuery, sorting, page: 1 },
      })),
    setProtocolsLaboratoryId: laboratoryId =>
      set(state => ({
        protocolsQuery: { ...state.protocolsQuery, laboratoryId, page: 1 },
      })),
    setProtocolsDepartmentId: departmentId =>
      set(state => ({
        protocolsQuery: { ...state.protocolsQuery, departmentId, page: 1 },
      })),
    resetProtocolsQuery: () =>
      set({
        protocolsQuery: { ...defaultQueryState },
      }),
  }))
);
