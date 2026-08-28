import { useAutoRefetchQuery } from '@/shared/model';
import { testObjectKeys, testObjectsApi } from '../api';

/** Имена объектов испытаний для селектов. */
export const useTestObjectNames = (
  laboratoryId: number | undefined,
  departmentId: number | undefined,
  enabled = true,
  keyVariant: 'names' | 'select' = 'names'
) => {
  const queryKey =
    keyVariant === 'select'
      ? testObjectKeys.select(laboratoryId, departmentId)
      : testObjectKeys.names(laboratoryId, departmentId);

  return useAutoRefetchQuery<string[]>(
    queryKey,
    async () => {
      if (keyVariant === 'select') {
        const items = await testObjectsApi.getTestObjectsForSelect(laboratoryId, departmentId);
        return items.map(item => item.name);
      }
      return testObjectsApi.getTestObjectNames(laboratoryId, departmentId);
    },
    { enabled: enabled && !!laboratoryId }
  );
};
