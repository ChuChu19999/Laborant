import { useMemo } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { useAutoRefetchQuery } from '@/shared/model';
import { type Protocol, protocolKeys, protocolsApi } from '../api';
import { useProtocolsQueryStore } from './protocolsQueryStore';
import type { PaginatedResponse } from '@/shared/lib/http';

/** Загружает пагинированный список протоколов с фильтрами из store. */
export const useProtocols = (laboratoryId?: number, departmentId?: number) => {
  const {
    protocolsQuery,
    setProtocolsPage,
    setProtocolsPageSize,
    setProtocolsFilters,
    setProtocolsSorting,
    setProtocolsLaboratoryId,
    setProtocolsDepartmentId,
  } = useProtocolsQueryStore();

  const effectiveLaboratoryId = laboratoryId ?? protocolsQuery.laboratoryId;
  const effectiveDepartmentId = departmentId ?? protocolsQuery.departmentId;

  const queryKey = useMemo(
    () =>
      protocolKeys.list(
        effectiveLaboratoryId,
        effectiveDepartmentId,
        protocolsQuery.page,
        protocolsQuery.pageSize,
        protocolsQuery.filters,
        protocolsQuery.sorting
      ),
    [
      effectiveLaboratoryId,
      effectiveDepartmentId,
      protocolsQuery.page,
      protocolsQuery.pageSize,
      protocolsQuery.filters,
      protocolsQuery.sorting,
    ]
  );

  const queryResult = useAutoRefetchQuery<PaginatedResponse<Protocol>>(
    queryKey,
    () =>
      protocolsApi.getProtocols(
        protocolsQuery.page,
        protocolsQuery.pageSize,
        protocolsQuery.filters,
        protocolsQuery.sorting,
        effectiveLaboratoryId,
        effectiveDepartmentId
      ),
    {
      enabled: !!effectiveLaboratoryId,
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
    page: protocolsQuery.page,
    pageSize: protocolsQuery.pageSize,
    filters: protocolsQuery.filters,
    sorting: protocolsQuery.sorting,
    laboratoryId: effectiveLaboratoryId,
    departmentId: effectiveDepartmentId,
    setPage: setProtocolsPage,
    setPageSize: setProtocolsPageSize,
    setFilters: setProtocolsFilters,
    setSorting: setProtocolsSorting,
    setLaboratoryId: setProtocolsLaboratoryId,
    setDepartmentId: setProtocolsDepartmentId,
    refetch: queryResult.refetch,
  };
};
