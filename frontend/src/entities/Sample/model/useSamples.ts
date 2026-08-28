import { useMemo } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { useAutoRefetchQuery } from '@/shared/model';
import { type Sample, sampleKeys, samplesApi } from '../api';
import { useSamplesQueryStore } from './samplesQueryStore';
import type { PaginatedResponse } from '@/shared/lib/http';

/** Загружает пагинированный список проб с фильтрами из store. */
export const useSamples = (laboratoryId?: number, departmentId?: number) => {
  const {
    samplesQuery,
    setSamplesPage,
    setSamplesPageSize,
    setSamplesFilters,
    setSamplesSorting,
    setSamplesLaboratoryId,
    setSamplesDepartmentId,
  } = useSamplesQueryStore();

  const effectiveLaboratoryId = laboratoryId ?? samplesQuery.laboratoryId;
  const effectiveDepartmentId = departmentId ?? samplesQuery.departmentId;

  const queryKey = useMemo(
    () =>
      sampleKeys.list(
        effectiveLaboratoryId,
        effectiveDepartmentId,
        samplesQuery.page,
        samplesQuery.pageSize,
        samplesQuery.filters,
        samplesQuery.sorting
      ),
    [
      effectiveLaboratoryId,
      effectiveDepartmentId,
      samplesQuery.page,
      samplesQuery.pageSize,
      samplesQuery.filters,
      samplesQuery.sorting,
    ]
  );

  const queryResult = useAutoRefetchQuery<PaginatedResponse<Sample>>(
    queryKey,
    () =>
      samplesApi.getSamples(
        samplesQuery.page,
        samplesQuery.pageSize,
        samplesQuery.filters,
        samplesQuery.sorting,
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
    page: samplesQuery.page,
    pageSize: samplesQuery.pageSize,
    filters: samplesQuery.filters,
    sorting: samplesQuery.sorting,
    laboratoryId: effectiveLaboratoryId,
    departmentId: effectiveDepartmentId,
    setPage: setSamplesPage,
    setPageSize: setSamplesPageSize,
    setFilters: setSamplesFilters,
    setSorting: setSamplesSorting,
    setLaboratoryId: setSamplesLaboratoryId,
    setDepartmentId: setSamplesDepartmentId,
    refetch: queryResult.refetch,
  };
};

/** Загружает пробу по идентификатору. */
export const useSample = (id: number | null, enabled: boolean = true) => {
  const isQueryEnabled = enabled && id != null;
  const queryResult = useAutoRefetchQuery<Sample>(
    sampleKeys.detail(id ?? 0),
    () => {
      if (id == null) {
        return Promise.reject(new Error('Sample id is required'));
      }
      return samplesApi.getSample(id);
    },
    {
      enabled: isQueryEnabled,
    }
  );

  return {
    data: queryResult.data,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    refetch: queryResult.refetch,
  };
};
