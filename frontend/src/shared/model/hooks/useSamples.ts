import { useMemo } from 'react';
import { type PaginatedResponse } from '../../api/research';
import { samplesApi, type Sample, type SampleFilters } from '../../api/samples';
import { useAutoRefetchQuery } from '../lib/useQuery';
import { useQueryStore } from '../stores';
import { useUrlSync } from './useUrlSync';

export const useSamples = (laboratoryId?: number, departmentId?: number) => {
  const {
    samplesQuery,
    setSamplesPage,
    setSamplesPageSize,
    setSamplesFilters,
    setSamplesSorting,
    setSamplesLaboratoryId,
    setSamplesDepartmentId,
  } = useQueryStore();

  const effectiveLaboratoryId = laboratoryId ?? samplesQuery.laboratoryId;
  const effectiveDepartmentId = departmentId ?? samplesQuery.departmentId;

  const urlSync = useUrlSync<SampleFilters>(
    {
      filterKeys: [
        'registration_number',
        'test_object',
        'sampling_location',
        'sampling_date_from',
        'sampling_date_to',
        'receiving_date_from',
        'receiving_date_to',
        'created_at_from',
        'created_at_to',
      ],
      defaultPage: 1,
      defaultPageSize: 20,
    },
    {
      ...samplesQuery,
      filters: samplesQuery.filters,
    },
    {
      setPage: setSamplesPage,
      setPageSize: setSamplesPageSize,
      setFilters: setSamplesFilters,
      setSorting: setSamplesSorting,
    }
  );

  const queryKey = useMemo(
    () => [
      'samples',
      'list',
      effectiveLaboratoryId,
      effectiveDepartmentId,
      samplesQuery.page,
      samplesQuery.pageSize,
      samplesQuery.filters,
      samplesQuery.sorting,
    ],
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
    setPage: urlSync.setPage,
    setPageSize: urlSync.setPageSize,
    setFilters: urlSync.setFilters,
    setSorting: urlSync.setSorting,
    setLaboratoryId: setSamplesLaboratoryId,
    setDepartmentId: setSamplesDepartmentId,
    refetch: queryResult.refetch,
  };
};

export const useSample = (id: number | null, enabled: boolean = true) => {
  const queryResult = useAutoRefetchQuery<Sample>(
    ['samples', id],
    () => samplesApi.getSample(id!),
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
