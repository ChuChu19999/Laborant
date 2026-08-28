import { create } from 'zustand';
import { logger } from '@/shared/lib/zustand';
import type { RoleFilters } from '../lib/roleTypeOptions';
import type { QueryState } from '@/shared/lib/zustand';

/** Состояние пагинации и фильтров списка ролей. */
export interface RolesQueryState extends QueryState {
  filters?: RoleFilters;
}

interface RolesQueryStore {
  rolesQuery: RolesQueryState;
  setRolesPage: (page: number) => void;
  setRolesPageSize: (pageSize: number) => void;
  setRolesFilters: (filters: RolesQueryState['filters']) => void;
  setRolesSorting: (sorting: RolesQueryState['sorting']) => void;
  resetRolesQuery: () => void;
}

const defaultQueryState: QueryState = {
  page: 1,
  pageSize: 20,
};

/** Zustand-хранилище параметров запроса списка ролей. */
export const useRolesQueryStore = create<RolesQueryStore>()(
  logger(set => ({
    rolesQuery: { ...defaultQueryState },
    setRolesPage: page =>
      set(state => ({
        rolesQuery: { ...state.rolesQuery, page },
      })),
    setRolesPageSize: pageSize =>
      set(state => ({
        rolesQuery: { ...state.rolesQuery, pageSize, page: 1 },
      })),
    setRolesFilters: filters =>
      set(state => ({
        rolesQuery: { ...state.rolesQuery, filters, page: 1 },
      })),
    setRolesSorting: sorting =>
      set(state => ({
        rolesQuery: { ...state.rolesQuery, sorting, page: 1 },
      })),
    resetRolesQuery: () =>
      set({
        rolesQuery: { ...defaultQueryState },
      }),
  }))
);
