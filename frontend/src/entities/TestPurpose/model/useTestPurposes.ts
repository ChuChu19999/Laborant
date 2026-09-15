import { keepPreviousData } from '@tanstack/react-query';
import { useAutoRefetchQuery } from '@/shared/model';
import {
  type TestPurpose,
  type TestPurposeListParams,
  testPurposeKeys,
  testPurposesApi,
} from '../api';

const DEFAULT_TEST_PURPOSE_LIST_PARAMS: TestPurposeListParams = {
  sort_by: 'name',
  sort_order: 'asc',
};

/** Загружает список целей испытаний в scope лаборатории/подразделения. */
export const useTestPurposesList = (
  laboratoryId?: number,
  departmentId?: number,
  enabled = true,
  params: TestPurposeListParams = DEFAULT_TEST_PURPOSE_LIST_PARAMS,
  keepPrevious = true
) => {
  const listParams: TestPurposeListParams = {
    ...DEFAULT_TEST_PURPOSE_LIST_PARAMS,
    ...params,
    laboratory_id: laboratoryId,
    department_id: departmentId,
  };

  return useAutoRefetchQuery<{ items: TestPurpose[] }>(
    testPurposeKeys.list(listParams),
    () => testPurposesApi.getTestPurposes(listParams),
    {
      enabled: enabled && !!laboratoryId,
      placeholderData: keepPrevious ? keepPreviousData : undefined,
    }
  );
};
