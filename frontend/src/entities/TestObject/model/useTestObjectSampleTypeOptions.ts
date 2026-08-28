import { useMemo } from 'react';
import { useAutoRefetchQuery } from '@/shared/model';
import { testObjectKeys, testObjectsApi } from '../api';
import { buildSampleTypeOptionsFromCatalog } from '../lib/testObjectOptions';

/** Загружает опции типов проб из каталога объектов испытаний. */
export const useTestObjectSampleTypeOptions = (
  laboratoryId?: number,
  departmentId?: number,
  enabled = true
) => {
  const queryResult = useAutoRefetchQuery(
    testObjectKeys.sampleTypeOptions(laboratoryId, departmentId),
    () => testObjectsApi.getTestObjectsForSelect(laboratoryId, departmentId),
    {
      enabled,
      staleTime: 30 * 1000,
    }
  );

  const options = useMemo(
    () => buildSampleTypeOptionsFromCatalog(queryResult.data ?? []),
    [queryResult.data]
  );

  return {
    options,
    isLoading: queryResult.isLoading,
    refetch: queryResult.refetch,
  };
};
