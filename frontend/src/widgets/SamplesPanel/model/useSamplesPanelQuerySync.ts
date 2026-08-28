import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { type SampleFilters, useSamplesQueryStore } from '@/entities/Sample';
import { useUrlSync } from '@/shared/model';
import { SAMPLE_FILTER_KEYS } from '../lib/buildSamplesColumnFilters';

/** Синхронизирует параметры списка проб между URL и Zustand-store. */
export const useSamplesPanelQuerySync = (labId?: number, deptId?: number) => {
  const [searchParams] = useSearchParams();
  const {
    samplesQuery,
    setSamplesPage,
    setSamplesPageSize,
    setSamplesFilters,
    setSamplesSorting,
    setSamplesLaboratoryId,
    setSamplesDepartmentId,
  } = useSamplesQueryStore();

  useUrlSync<SampleFilters>(
    {
      filterKeys: SAMPLE_FILTER_KEYS,
      arrayFilterKeys: ['sample_types', 'test_objects'],
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

  const previousLabIdRef = useRef<number | undefined>(undefined);
  const previousDeptIdRef = useRef<number | undefined>(undefined);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    const labIdChanged = labId !== previousLabIdRef.current;
    const deptIdChanged = deptId !== previousDeptIdRef.current;

    if (labIdChanged) {
      setSamplesLaboratoryId(labId);
    }
    if (deptIdChanged) {
      setSamplesDepartmentId(deptId);
    }

    if (isInitialMountRef.current) {
      if (!samplesQuery.pageSize) {
        setSamplesPageSize(20);
      }
      if (!samplesQuery.sorting) {
        setSamplesSorting({ sort_by: 'created_at', sort_order: 'desc' });
      }
      isInitialMountRef.current = false;
    }

    previousLabIdRef.current = labId;
    previousDeptIdRef.current = deptId;
  }, [
    labId,
    deptId,
    samplesQuery.pageSize,
    samplesQuery.sorting,
    setSamplesDepartmentId,
    setSamplesLaboratoryId,
    setSamplesPageSize,
    setSamplesSorting,
  ]);

  return { searchParams };
};
