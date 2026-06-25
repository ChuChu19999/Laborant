import { useMemo } from 'react';
import { rolesApi, type RoleCatalogItem, type RoleFilters } from '../../api/roles';
import { useAutoRefetchQuery } from '../lib/useQuery';
import { useQueryStore } from '../stores';
import { useUrlSync } from './useUrlSync';
import type { PaginatedResponse } from '../../api/research';

export const useRoles = () => {
  const { rolesQuery, setRolesPage, setRolesPageSize, setRolesFilters, setRolesSorting } =
    useQueryStore();

  const urlSync = useUrlSync<RoleFilters>(
    {
      filterKeys: ['search', 'name', 'role_type'],
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

  const queryKey = useMemo(
    () => [
      'roles',
      'catalog',
      rolesQuery.page,
      rolesQuery.pageSize,
      rolesQuery.filters,
      rolesQuery.sorting,
    ],
    [rolesQuery.page, rolesQuery.pageSize, rolesQuery.filters, rolesQuery.sorting]
  );

  const queryResult = useAutoRefetchQuery<PaginatedResponse<RoleCatalogItem>>(
    queryKey,
    () =>
      rolesApi.getRoles(
        rolesQuery.page,
        rolesQuery.pageSize,
        rolesQuery.filters,
        rolesQuery.sorting
      ),
    {
      staleTime: 10 * 1000,
    }
  );

  return {
    data: queryResult.data?.items ?? [],
    total: queryResult.data?.total ?? 0,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    error: queryResult.error,
    page: rolesQuery.page,
    pageSize: rolesQuery.pageSize,
    filters: rolesQuery.filters,
    sorting: rolesQuery.sorting,
    setPage: urlSync.setPage,
    setPageSize: urlSync.setPageSize,
    setFilters: urlSync.setFilters,
    setSorting: urlSync.setSorting,
    refetch: queryResult.refetch,
  };
};
