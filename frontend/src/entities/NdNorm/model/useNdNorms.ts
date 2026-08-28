import { useMemo } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { useAutoRefetchQuery } from '@/shared/model';
import { type NdNorm, ndNormKeys, ndNormsApi } from '../api';
import { useNdNormsQueryStore } from './ndNormsQueryStore';
import type { PaginatedResponse } from '@/shared/lib/http';

/** Загружает пагинированный список норм НД с фильтрами из store. */
export const useNdNorms = (laboratoryId?: number, departmentId?: number) => {
  const {
    ndNormsQuery,
    setNdNormsPage,
    setNdNormsPageSize,
    setNdNormsFilters,
    setNdNormsSorting,
    setNdNormsLaboratoryId,
    setNdNormsDepartmentId,
  } = useNdNormsQueryStore();

  const effectiveLaboratoryId = laboratoryId ?? ndNormsQuery.laboratoryId;
  const effectiveDepartmentId = departmentId ?? ndNormsQuery.departmentId;

  const queryKey = useMemo(
    () =>
      ndNormKeys.list(
        effectiveLaboratoryId,
        effectiveDepartmentId,
        ndNormsQuery.page,
        ndNormsQuery.pageSize,
        ndNormsQuery.filters,
        ndNormsQuery.sorting
      ),
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
      placeholderData: keepPreviousData,
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
    setPage: setNdNormsPage,
    setPageSize: setNdNormsPageSize,
    setFilters: setNdNormsFilters,
    setSorting: setNdNormsSorting,
    setLaboratoryId: setNdNormsLaboratoryId,
    setDepartmentId: setNdNormsDepartmentId,
    refetch: queryResult.refetch,
  };
};
