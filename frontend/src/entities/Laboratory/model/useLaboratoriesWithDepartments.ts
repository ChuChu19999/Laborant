import { departmentsApi } from '@/entities/Department/@x/Laboratory';
import { useAutoRefetchQuery } from '@/shared/model';
import { laboratoriesApi, laboratoryKeys } from '../api';
import type { LaboratoryWithDepartments } from '../lib/visibilityScopeOptions';

/** Загружает лаборатории вместе с подразделениями для форм видимости. */
export const useLaboratoriesWithDepartments = (enabled = true) => {
  const queryResult = useAutoRefetchQuery<LaboratoryWithDepartments[]>(
    laboratoryKeys.withDepartments(),
    async () => {
      const response = await laboratoriesApi.getLaboratories({ page_size: 100 });
      const laboratories = response.items.filter(item => !item.deleted_at);

      return Promise.all(
        laboratories.map(async laboratory => {
          const hasDepartments = (laboratory.departments_count ?? 0) > 0;
          const departments = hasDepartments
            ? await departmentsApi.getDepartmentsByLaboratory(laboratory.id)
            : [];

          return {
            laboratory,
            departments: departments.filter(item => !item.deleted_at),
          };
        })
      );
    },
    {
      enabled,
      staleTime: 60 * 1000,
    }
  );

  const labsWithDepartments = queryResult.data ?? [];

  return {
    labsWithDepartments,
    isLoading: queryResult.isLoading,
    refetch: queryResult.refetch,
  };
};
