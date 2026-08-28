import { useSearchParams } from 'react-router-dom';
import { useRolesQueryStore, type RoleFilters } from '@/entities/Role';
import { useUrlSync } from '@/shared/model';
import { ROLE_FILTER_KEYS } from '../lib/buildRolesColumnFilters';

/** Синхронизирует параметры списка ролей между URL и Zustand-store. */
export const useRolesPanelQuerySync = () => {
  const [searchParams] = useSearchParams();
  const { rolesQuery, setRolesPage, setRolesPageSize, setRolesFilters, setRolesSorting } =
    useRolesQueryStore();

  useUrlSync<RoleFilters>(
    {
      filterKeys: ROLE_FILTER_KEYS,
      defaultPage: 1,
      defaultPageSize: 20,
    },
    {
      ...rolesQuery,
      filters: rolesQuery.filters,
    },
    {
      setPage: setRolesPage,
      setPageSize: setRolesPageSize,
      setFilters: setRolesFilters,
      setSorting: setRolesSorting,
    }
  );

  return { searchParams };
};
