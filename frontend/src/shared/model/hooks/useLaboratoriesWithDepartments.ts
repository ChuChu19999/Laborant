import { useMemo } from 'react';
import { laboratoriesApi } from '../../api/laboratories';
import { useAutoRefetchQuery } from '../lib/useQuery';
import type { LaboratoryWithDepartments } from '../../lib/visibilityScopeOptions';

export const useLaboratoriesWithDepartments = (enabled = true) => {
  const queryResult = useAutoRefetchQuery<LaboratoryWithDepartments[]>(
    ['laboratories', 'with-departments'],
    async () => {
      const response = await laboratoriesApi.getLaboratories({ page_size: 100 });
      const laboratories = response.items.filter(item => !item.deleted_at);

      return Promise.all(
        laboratories.map(async laboratory => {
          const hasDepartments = (laboratory.departments_count ?? 0) > 0;
          const departments = hasDepartments
            ? await laboratoriesApi.getDepartmentsByLaboratory(laboratory.id)
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

  const labsWithDepartments = useMemo(() => queryResult.data ?? [], [queryResult.data]);

  return {
    labsWithDepartments,
    isLoading: queryResult.isLoading,
    refetch: queryResult.refetch,
  };
};
