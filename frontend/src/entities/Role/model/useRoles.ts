import { useMemo } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { useAutoRefetchQuery } from '@/shared/model';
import { type RoleCatalogItem, roleKeys, rolesApi } from '../api';
import { useRolesQueryStore } from './rolesQueryStore';
import type { PaginatedResponse } from '@/shared/lib/http';

/** Загружает пагинированный каталог ролей с фильтрами из store. */
export const useRoles = () => {
  const { rolesQuery, setRolesPage, setRolesPageSize, setRolesFilters, setRolesSorting } =
    useRolesQueryStore();

  const queryKey = useMemo(
    () =>
      roleKeys.list(rolesQuery.page, rolesQuery.pageSize, rolesQuery.filters, rolesQuery.sorting),
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
      placeholderData: keepPreviousData,
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
    setPage: setRolesPage,
    setPageSize: setRolesPageSize,
    setFilters: setRolesFilters,
    setSorting: setRolesSorting,
    refetch: queryResult.refetch,
  };
};
