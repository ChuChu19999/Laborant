import { useMemo } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { useAutoRefetchQuery } from '@/shared/model';
import { type TestObjectCatalogItem, testObjectKeys, testObjectsApi } from '../api';
import { useTestObjectsQueryStore } from './testObjectsQueryStore';
import type { PaginatedResponse } from '@/shared/lib/http';

/** Загружает пагинированный каталог объектов испытаний с фильтрами из store. */
export const useTestObjects = () => {
  const {
    testObjectsQuery,
    setTestObjectsPage,
    setTestObjectsPageSize,
    setTestObjectsFilters,
    setTestObjectsSorting,
  } = useTestObjectsQueryStore();

  const queryKey = useMemo(
    () =>
      testObjectKeys.list(
        testObjectsQuery.page,
        testObjectsQuery.pageSize,
        testObjectsQuery.filters,
        testObjectsQuery.sorting
      ),
    [
      testObjectsQuery.page,
      testObjectsQuery.pageSize,
      testObjectsQuery.filters,
      testObjectsQuery.sorting,
    ]
  );

  const queryResult = useAutoRefetchQuery<PaginatedResponse<TestObjectCatalogItem>>(
    queryKey,
    () =>
      testObjectsApi.getTestObjects(
        testObjectsQuery.page,
        testObjectsQuery.pageSize,
        testObjectsQuery.filters,
        testObjectsQuery.sorting
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
    page: testObjectsQuery.page,
    pageSize: testObjectsQuery.pageSize,
    filters: testObjectsQuery.filters,
    sorting: testObjectsQuery.sorting,
    setPage: setTestObjectsPage,
    setPageSize: setTestObjectsPageSize,
    setFilters: setTestObjectsFilters,
    setSorting: setTestObjectsSorting,
    refetch: queryResult.refetch,
  };
};
