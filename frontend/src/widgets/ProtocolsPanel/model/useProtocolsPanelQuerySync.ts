import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { type ProtocolFilters, useProtocolsQueryStore } from '@/entities/Protocol';
import { useUrlSync } from '@/shared/model';
import { PROTOCOL_FILTER_KEYS } from '../lib/buildProtocolsColumnFilters';

/** Синхронизирует параметры списка протоколов между URL и Zustand-store. */
export const useProtocolsPanelQuerySync = (labId?: number, deptId?: number) => {
  const [searchParams] = useSearchParams();
  const {
    protocolsQuery,
    setProtocolsPage,
    setProtocolsPageSize,
    setProtocolsFilters,
    setProtocolsSorting,
    setProtocolsLaboratoryId,
    setProtocolsDepartmentId,
  } = useProtocolsQueryStore();

  useUrlSync<ProtocolFilters>(
    {
      filterKeys: PROTOCOL_FILTER_KEYS,
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

  const previousLabIdRef = useRef<number | undefined>(undefined);
  const previousDeptIdRef = useRef<number | undefined>(undefined);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    const labIdChanged = labId !== previousLabIdRef.current;
    const deptIdChanged = deptId !== previousDeptIdRef.current;

    if (labIdChanged) {
      setProtocolsLaboratoryId(labId);
    }
    if (deptIdChanged) {
      setProtocolsDepartmentId(deptId);
    }

    if (isInitialMountRef.current) {
      if (!protocolsQuery.pageSize) {
        setProtocolsPageSize(20);
      }
      if (!protocolsQuery.sorting) {
        setProtocolsSorting({ sort_by: 'created_at', sort_order: 'desc' });
      }
      isInitialMountRef.current = false;
    }

    previousLabIdRef.current = labId;
    previousDeptIdRef.current = deptId;
  }, [
    labId,
    deptId,
    protocolsQuery.pageSize,
    protocolsQuery.sorting,
    setProtocolsDepartmentId,
    setProtocolsLaboratoryId,
    setProtocolsPageSize,
    setProtocolsSorting,
  ]);

  return { searchParams };
};
