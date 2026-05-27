import { useMemo } from 'react';
import { testObjectsApi } from '../../api/testObjects';
import { buildSampleTypeOptionsFromCatalog } from '../../lib/testObjectOptions';
import { useAutoRefetchQuery } from '../lib/useQuery';

export const useTestObjectSampleTypeOptions = (
  laboratoryId?: number,
  departmentId?: number,
  enabled = true
) => {
  const queryResult = useAutoRefetchQuery(
    ['test-objects', 'sample-type-options', laboratoryId, departmentId],
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
