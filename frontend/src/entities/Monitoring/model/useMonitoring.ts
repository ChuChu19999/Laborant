import { useMemo } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { useAutoRefetchQuery } from '@/shared/model';
import { monitoringApi, monitoringKeys, type MonitoringErrorItem } from '../api';
import { useMonitoringQueryStore } from './monitoringQueryStore';
import type { PaginatedResponse } from '@/shared/lib/http';

/** Загружает пагинированный список ошибок мониторинга с фильтрами из store. */
export const useMonitoring = () => {
  const {
    monitoringQuery,
    setMonitoringPage,
    setMonitoringPageSize,
    setMonitoringFilters,
    setMonitoringSorting,
    resetMonitoringQuery,
  } = useMonitoringQueryStore();

  const filters = useMemo(
    () => monitoringQuery.filters ?? { period: '24h' as const },
    [monitoringQuery.filters]
  );

  const queryKey = useMemo(
    () =>
      monitoringKeys.errorsList(
        monitoringQuery.page,
        monitoringQuery.pageSize,
        filters,
        monitoringQuery.sorting ?? {}
      ),
    [monitoringQuery.page, monitoringQuery.pageSize, filters, monitoringQuery.sorting]
  );

  const queryResult = useAutoRefetchQuery<PaginatedResponse<MonitoringErrorItem>>(
    queryKey,
    () =>
      monitoringApi.getErrors({
        page: monitoringQuery.page,
        page_size: monitoringQuery.pageSize,
        filters,
        sorting: monitoringQuery.sorting,
      }),
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
    page: monitoringQuery.page,
    pageSize: monitoringQuery.pageSize,
    filters,
    sorting: monitoringQuery.sorting,
    setPage: setMonitoringPage,
    setPageSize: setMonitoringPageSize,
    setFilters: setMonitoringFilters,
    setSorting: setMonitoringSorting,
    resetQuery: resetMonitoringQuery,
    refetch: queryResult.refetch,
  };
};
