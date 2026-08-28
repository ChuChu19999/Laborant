import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { type EquipmentFilters, useEquipmentQueryStore } from '@/entities/Equipment';
import { useUrlSync } from '@/shared/model';
import { EQUIPMENT_URL_SYNC_FILTER_KEYS } from '../lib/buildEquipmentColumnFilters';

/** Синхронизирует параметры списка приборов между URL и Zustand-store. */
export const useEquipmentPanelQuerySync = (labId?: number, deptId?: number) => {
  const [searchParams] = useSearchParams();
  const {
    equipmentQuery,
    setEquipmentPage,
    setEquipmentPageSize,
    setEquipmentFilters,
    setEquipmentSorting,
    setEquipmentLaboratoryId,
    setEquipmentDepartmentId,
  } = useEquipmentQueryStore();

  useUrlSync<EquipmentFilters>(
    {
      filterKeys: EQUIPMENT_URL_SYNC_FILTER_KEYS,
      defaultPage: 1,
      defaultPageSize: 20,
    },
    {
      ...equipmentQuery,
      filters: equipmentQuery.filters,
    },
    {
      setPage: setEquipmentPage,
      setPageSize: setEquipmentPageSize,
      setFilters: setEquipmentFilters,
      setSorting: setEquipmentSorting,
    }
  );

  const previousLabIdRef = useRef<number | undefined>(undefined);
  const previousDeptIdRef = useRef<number | undefined>(undefined);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    const labIdChanged = labId !== previousLabIdRef.current;
    const deptIdChanged = deptId !== previousDeptIdRef.current;

    if (labIdChanged) {
      setEquipmentLaboratoryId(labId);
    }
    if (deptIdChanged) {
      setEquipmentDepartmentId(deptId);
    }

    if (isInitialMountRef.current) {
      if (!equipmentQuery.pageSize) {
        setEquipmentPageSize(20);
      }
      if (!equipmentQuery.sorting) {
        setEquipmentSorting({ sort_by: 'created_at', sort_order: 'desc' });
      }
      isInitialMountRef.current = false;
    }

    previousLabIdRef.current = labId;
    previousDeptIdRef.current = deptId;
  }, [
    labId,
    deptId,
    equipmentQuery.pageSize,
    equipmentQuery.sorting,
    setEquipmentDepartmentId,
    setEquipmentLaboratoryId,
    setEquipmentPageSize,
    setEquipmentSorting,
  ]);

  return { searchParams };
};
