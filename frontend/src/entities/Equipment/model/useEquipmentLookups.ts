import { useAutoRefetchQuery } from '@/shared/model';
import { type Equipment, equipmentApi, equipmentKeys } from '../api';
import type { PaginatedResponse } from '@/shared/lib/http';

/** Загружает оборудование в области видимости лаборатории/подразделения. */
export const useEquipmentForScope = (
  laboratoryId: number | undefined,
  departmentId: number | undefined,
  enabled = true
) => {
  return useAutoRefetchQuery<PaginatedResponse<Equipment>>(
    equipmentKeys.forScope(laboratoryId, departmentId),
    () =>
      equipmentApi.getEquipment(
        undefined,
        undefined,
        undefined,
        undefined,
        laboratoryId,
        departmentId
      ),
    { enabled: enabled && !!laboratoryId }
  );
};

/** Загружает оборудование для формы расчёта. */
export const useEquipmentForCalculation = (
  laboratoryId: number | undefined,
  departmentId: number | undefined,
  enabled = true
) => {
  return useAutoRefetchQuery<PaginatedResponse<Equipment>>(
    equipmentKeys.forCalculation(laboratoryId, departmentId),
    () =>
      equipmentApi.getEquipment(
        undefined,
        undefined,
        undefined,
        undefined,
        laboratoryId,
        departmentId
      ),
    { enabled: enabled && !!laboratoryId }
  );
};
