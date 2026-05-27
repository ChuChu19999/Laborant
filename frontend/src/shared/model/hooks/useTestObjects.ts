import { useMemo } from 'react';
import {
  testObjectsApi,
  type TestObjectCatalogItem,
  type TestObjectFilters,
} from '../../api/testObjects';
import { useAutoRefetchQuery } from '../lib/useQuery';
import { useQueryStore } from '../stores';
import { useUrlSync } from './useUrlSync';
import type { PaginatedResponse } from '../../api/research';

export const useTestObjects = () => {
  const {
    testObjectsQuery,
    setTestObjectsPage,
    setTestObjectsPageSize,
    setTestObjectsFilters,
    setTestObjectsSorting,
  } = useQueryStore();

  const urlSync = useUrlSync<TestObjectFilters>(
    {
      filterKeys: ['search', 'name', 'tag'],
      defaultPage: 1,
      defaultPageSize: 20,
    },
    {
      ...testObjectsQuery,
      filters: testObjectsQuery.filters,
    },
    {
      setPage: setTestObjectsPage,
      setPageSize: setTestObjectsPageSize,
      setFilters: setTestObjectsFilters,
      setSorting: setTestObjectsSorting,
    }
  );

  const queryKey = useMemo(
    () => [
      'test-objects',
      'catalog',
      testObjectsQuery.page,
      testObjectsQuery.pageSize,
      testObjectsQuery.filters,
      testObjectsQuery.sorting,
    ],
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
    setPage: urlSync.setPage,
    setPageSize: urlSync.setPageSize,
    setFilters: urlSync.setFilters,
    setSorting: urlSync.setSorting,
    refetch: queryResult.refetch,
  };
};
