import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { type NdNormFilters, useNdNormsQueryStore } from '@/entities/NdNorm';
import { useUrlSync } from '@/shared/model';
import { ND_NORM_FILTER_KEYS } from '../lib/buildNdNormsColumnFilters';

/** Синхронизирует параметры списка норм НД между URL и Zustand-store. */
export const useNdNormsPanelQuerySync = (labId?: number, deptId?: number) => {
  const [searchParams] = useSearchParams();
  const {
    ndNormsQuery,
    setNdNormsPage,
    setNdNormsPageSize,
    setNdNormsFilters,
    setNdNormsSorting,
    setNdNormsLaboratoryId,
    setNdNormsDepartmentId,
  } = useNdNormsQueryStore();

  useUrlSync<NdNormFilters>(
    {
      filterKeys: ND_NORM_FILTER_KEYS,
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

  const previousLabIdRef = useRef<number | undefined>(undefined);
  const previousDeptIdRef = useRef<number | undefined>(undefined);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    const labIdChanged = labId !== previousLabIdRef.current;
    const deptIdChanged = deptId !== previousDeptIdRef.current;

    if (labIdChanged) {
      setNdNormsLaboratoryId(labId);
    }
    if (deptIdChanged) {
      setNdNormsDepartmentId(deptId);
    }

    if (isInitialMountRef.current) {
      if (!ndNormsQuery.pageSize) {
        setNdNormsPageSize(20);
      }
      if (!ndNormsQuery.sorting) {
        setNdNormsSorting({ sort_by: 'name', sort_order: 'asc' });
      }
      isInitialMountRef.current = false;
    }

    previousLabIdRef.current = labId;
    previousDeptIdRef.current = deptId;
  }, [
    labId,
    deptId,
    ndNormsQuery.pageSize,
    ndNormsQuery.sorting,
    setNdNormsDepartmentId,
    setNdNormsLaboratoryId,
    setNdNormsPageSize,
    setNdNormsSorting,
  ]);

  return { searchParams };
};
