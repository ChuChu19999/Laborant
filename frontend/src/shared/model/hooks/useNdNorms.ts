import { useMemo } from 'react';
import { ndNormsApi, type NdNorm, type NdNormFilters } from '../../api/ndNorms';
import { type PaginatedResponse } from '../../api/research';
import { useAutoRefetchQuery } from '../lib/useQuery';
import { useQueryStore } from '../stores';
import { useUrlSync } from './useUrlSync';

export const useNdNorms = (laboratoryId?: number, departmentId?: number) => {
  const {
    ndNormsQuery,
    setNdNormsPage,
    setNdNormsPageSize,
    setNdNormsFilters,
    setNdNormsSorting,
    setNdNormsLaboratoryId,
    setNdNormsDepartmentId,
  } = useQueryStore();

  const effectiveLaboratoryId = laboratoryId ?? ndNormsQuery.laboratoryId;
  const effectiveDepartmentId = departmentId ?? ndNormsQuery.departmentId;

  const urlSync = useUrlSync<NdNormFilters>(
    {
      filterKeys: ['name', 'test_object', 'test_objects', 'created_at_from', 'created_at_to'],
      defaultPage: 1,
      defaultPageSize: 20,
    },
    {
      ...ndNormsQuery,
      filters: ndNormsQuery.filters,
    },
    {
      setPage: setNdNormsPage,
      setPageSize: setNdNormsPageSize,
      setFilters: setNdNormsFilters,
      setSorting: setNdNormsSorting,
    }
  );

  const queryKey = useMemo(
    () => [
      'nd-norms',
      'list',
      effectiveLaboratoryId,
      effectiveDepartmentId,
      ndNormsQuery.page,
      ndNormsQuery.pageSize,
      ndNormsQuery.filters,
      ndNormsQuery.sorting,
    ],
    [
      effectiveLaboratoryId,
      effectiveDepartmentId,
      ndNormsQuery.page,
      ndNormsQuery.pageSize,
      ndNormsQuery.filters,
      ndNormsQuery.sorting,
    ]
  );

  const queryResult = useAutoRefetchQuery<PaginatedResponse<NdNorm>>(
    queryKey,
    () =>
      ndNormsApi.getNdNorms(
        ndNormsQuery.page,
        ndNormsQuery.pageSize,
        ndNormsQuery.filters,
        ndNormsQuery.sorting,
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
    page: ndNormsQuery.page,
    pageSize: ndNormsQuery.pageSize,
    filters: ndNormsQuery.filters,
    sorting: ndNormsQuery.sorting,
    laboratoryId: effectiveLaboratoryId,
    departmentId: effectiveDepartmentId,
    setPage: urlSync.setPage,
    setPageSize: urlSync.setPageSize,
    setFilters: urlSync.setFilters,
    setSorting: urlSync.setSorting,
    setLaboratoryId: setNdNormsLaboratoryId,
    setDepartmentId: setNdNormsDepartmentId,
    refetch: queryResult.refetch,
  };
};
