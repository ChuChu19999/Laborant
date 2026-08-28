import { useAutoRefetchQuery } from '@/shared/model';
import { type Department, departmentKeys, departmentsApi } from '../api';

/** Загружает подразделения лаборатории. */
export const useDepartmentsByLaboratory = (laboratoryId: number | undefined, enabled = true) => {
  const isQueryEnabled = enabled && laboratoryId != null;
  return useAutoRefetchQuery<Department[]>(
    departmentKeys.byLaboratory(laboratoryId),
    () => {
      if (laboratoryId == null) {
        return Promise.reject(new Error('Laboratory id is required'));
      }
      return departmentsApi.getDepartmentsByLaboratory(laboratoryId);
    },
    { enabled: isQueryEnabled }
  );
};
