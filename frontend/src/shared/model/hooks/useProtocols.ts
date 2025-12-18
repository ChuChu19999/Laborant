import { useMemo } from 'react';
import { protocolsApi, type Protocol, type ProtocolFilters } from '../../api/protocols';
import { type PaginatedResponse } from '../../api/research';
import { useAutoRefetchQuery } from '../lib/useQuery';
import { useQueryStore } from '../stores';
import { useUrlSync } from './useUrlSync';

export const useProtocols = (laboratoryId?: number, departmentId?: number) => {
  const {
    protocolsQuery,
    setProtocolsPage,
    setProtocolsPageSize,
    setProtocolsFilters,
    setProtocolsSorting,
    setProtocolsLaboratoryId,
    setProtocolsDepartmentId,
  } = useQueryStore();

  const effectiveLaboratoryId = laboratoryId ?? protocolsQuery.laboratoryId;
  const effectiveDepartmentId = departmentId ?? protocolsQuery.departmentId;

  const urlSync = useUrlSync<ProtocolFilters>(
    {
      filterKeys: [
        'test_protocol_number',
        'sampling_act_number',
        'is_accredited',
        'search_samples',
        'test_protocol_date_from',
        'test_protocol_date_to',
        'created_at_from',
        'created_at_to',
      ],
      defaultPage: 1,
      defaultPageSize: 20,
    },
    {
      ...protocolsQuery,
      filters: protocolsQuery.filters,
    },
    {
      setPage: setProtocolsPage,
      setPageSize: setProtocolsPageSize,
      setFilters: setProtocolsFilters,
      setSorting: setProtocolsSorting,
    }
  );

  const queryKey = useMemo(
    () => [
      'protocols',
      'list',
      effectiveLaboratoryId,
      effectiveDepartmentId,
      protocolsQuery.page,
      protocolsQuery.pageSize,
      protocolsQuery.filters,
      protocolsQuery.sorting,
    ],
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
    setPage: urlSync.setPage,
    setPageSize: urlSync.setPageSize,
    setFilters: urlSync.setFilters,
    setSorting: urlSync.setSorting,
    setLaboratoryId: setProtocolsLaboratoryId,
    setDepartmentId: setProtocolsDepartmentId,
    refetch: queryResult.refetch,
  };
};

export const useProtocol = (id: number | null, enabled: boolean = true) => {
  const queryResult = useAutoRefetchQuery<Protocol>(
    ['protocols', id],
    () => protocolsApi.getProtocol(id!),
    {
      enabled: enabled && !!id,
    }
  );

  return {
    data: queryResult.data,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    refetch: queryResult.refetch,
  };
};
