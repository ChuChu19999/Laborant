import { useMemo } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { useAutoRefetchQuery } from '@/shared/model';
import { type Equipment, equipmentApi, equipmentKeys } from '../api';
import { useEquipmentQueryStore } from './equipmentQueryStore';
import type { PaginatedResponse } from '@/shared/lib/http';

/** Загружает пагинированный список оборудования с фильтрами из store. */
export const useEquipment = (laboratoryId?: number, departmentId?: number) => {
  const {
    equipmentQuery,
    setEquipmentPage,
    setEquipmentPageSize,
    setEquipmentFilters,
    setEquipmentSorting,
    setEquipmentLaboratoryId,
    setEquipmentDepartmentId,
  } = useEquipmentQueryStore();

  const effectiveLaboratoryId = laboratoryId ?? equipmentQuery.laboratoryId;
  const effectiveDepartmentId = departmentId ?? equipmentQuery.departmentId;

  const queryKey = useMemo(
    () =>
      equipmentKeys.list(
        effectiveLaboratoryId,
        effectiveDepartmentId,
        equipmentQuery.page,
        equipmentQuery.pageSize,
        equipmentQuery.filters,
        equipmentQuery.sorting
      ),
    [
      effectiveLaboratoryId,
      effectiveDepartmentId,
      equipmentQuery.page,
      equipmentQuery.pageSize,
      equipmentQuery.filters,
      equipmentQuery.sorting,
    ]
  );

  const queryResult = useAutoRefetchQuery<PaginatedResponse<Equipment>>(
    queryKey,
    () =>
      equipmentApi.getEquipment(
        equipmentQuery.page,
        equipmentQuery.pageSize,
        equipmentQuery.filters,
        equipmentQuery.sorting,
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
    page: equipmentQuery.page,
    pageSize: equipmentQuery.pageSize,
    filters: equipmentQuery.filters,
    sorting: equipmentQuery.sorting,
    laboratoryId: effectiveLaboratoryId,
    departmentId: effectiveDepartmentId,
    setPage: setEquipmentPage,
    setPageSize: setEquipmentPageSize,
    setFilters: setEquipmentFilters,
    setSorting: setEquipmentSorting,
    setLaboratoryId: setEquipmentLaboratoryId,
    setDepartmentId: setEquipmentDepartmentId,
    refetch: queryResult.refetch,
  };
};
