import { useMemo } from 'react';
import { equipmentApi, type Equipment, type EquipmentFilters } from '../../api/equipment';
import { type PaginatedResponse } from '../../api/research';
import { useAutoRefetchQuery } from '../lib/useQuery';
import { useQueryStore } from '../stores';
import { useUrlSync } from './useUrlSync';

export const useEquipment = (laboratoryId?: number, departmentId?: number) => {
  const {
    equipmentQuery,
    setEquipmentPage,
    setEquipmentPageSize,
    setEquipmentFilters,
    setEquipmentSorting,
    setEquipmentLaboratoryId,
    setEquipmentDepartmentId,
  } = useQueryStore();

  const effectiveLaboratoryId = laboratoryId ?? equipmentQuery.laboratoryId;
  const effectiveDepartmentId = departmentId ?? equipmentQuery.departmentId;

  const urlSync = useUrlSync<EquipmentFilters>(
    {
      filterKeys: [
        'name',
        'serial_number',
        'type',
        'verification_end_date_from',
        'verification_end_date_to',
        'created_at_from',
        'created_at_to',
      ],
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

  const queryKey = useMemo(
    () => [
      'equipment',
      'list',
      effectiveLaboratoryId,
      effectiveDepartmentId,
      equipmentQuery.page,
      equipmentQuery.pageSize,
      equipmentQuery.filters,
      equipmentQuery.sorting,
    ],
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
    setPage: urlSync.setPage,
    setPageSize: urlSync.setPageSize,
    setFilters: urlSync.setFilters,
    setSorting: urlSync.setSorting,
    setLaboratoryId: setEquipmentLaboratoryId,
    setDepartmentId: setEquipmentDepartmentId,
    refetch: queryResult.refetch,
  };
};

export const useEquipmentById = (id: number | null, enabled: boolean = true) => {
  const queryResult = useAutoRefetchQuery<Equipment>(
    ['equipment', id],
    () => equipmentApi.getEquipmentById(id!),
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
