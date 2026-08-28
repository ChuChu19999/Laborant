import { useAutoRefetchQuery } from '@/shared/model';
import { type Branch, branchKeys, branchesApi } from '../api';

export interface BranchListParams {
  search?: string;
  sort_by?: string;
  sort_order?: string;
}

const DEFAULT_BRANCH_LIST_PARAMS: BranchListParams = {
  sort_by: 'name',
  sort_order: 'asc',
};

/** Загружает филиалы лаборатории или подразделения. */
export const useBranches = (
  laboratoryId: number | undefined,
  departmentId: number | undefined,
  enabled = true,
  params: BranchListParams = DEFAULT_BRANCH_LIST_PARAMS
) => {
  const listParams = { ...DEFAULT_BRANCH_LIST_PARAMS, ...params };

  return useAutoRefetchQuery<{ items: Branch[] }>(
    branchKeys.list(laboratoryId, departmentId, listParams),
    () => branchesApi.getBranches(laboratoryId, departmentId, listParams),
    { enabled: enabled && !!laboratoryId }
  );
};
