import { keepPreviousData } from '@tanstack/react-query';
import { useAutoRefetchQuery } from '@/shared/model';
import { type SampleType, type SampleTypeListParams, sampleTypeKeys, sampleTypesApi } from '../api';

const DEFAULT_SAMPLE_TYPE_LIST_PARAMS: SampleTypeListParams = {
  sort_by: 'name',
  sort_order: 'asc',
};

/** Загружает список типов проб в scope лаборатории/подразделения. */
export const useSampleTypesList = (
  laboratoryId?: number,
  departmentId?: number,
  enabled = true,
  params: SampleTypeListParams = DEFAULT_SAMPLE_TYPE_LIST_PARAMS,
  keepPrevious = true
) => {
  const listParams: SampleTypeListParams = {
    ...DEFAULT_SAMPLE_TYPE_LIST_PARAMS,
    ...params,
    laboratory_id: laboratoryId,
    department_id: departmentId,
  };

  return useAutoRefetchQuery<{ items: SampleType[] }>(
    sampleTypeKeys.list(listParams),
    () => sampleTypesApi.getSampleTypes(listParams),
    {
      enabled: enabled && !!laboratoryId,
      placeholderData: keepPrevious ? keepPreviousData : undefined,
    }
  );
};
