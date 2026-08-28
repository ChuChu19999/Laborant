import { keepPreviousData } from '@tanstack/react-query';
import { useAutoRefetchQuery } from '@/shared/model';
import { type WellMode, wellModeKeys, wellModesApi } from '../api';

export interface WellModeListParams {
  search?: string;
  sort_by?: string;
  sort_order?: string;
}

const DEFAULT_WELL_MODE_LIST_PARAMS: WellModeListParams = {
  sort_by: 'name',
  sort_order: 'asc',
};

/** Загружает режимы скважин по филиалу. */
export const useWellModesByBranch = (
  branchId: number | undefined,
  enabled = true,
  params: WellModeListParams = DEFAULT_WELL_MODE_LIST_PARAMS,
  keepPrevious = true
) => {
  const listParams = { ...DEFAULT_WELL_MODE_LIST_PARAMS, ...params };

  return useAutoRefetchQuery<{ items: WellMode[] }>(
    wellModeKeys.list(branchId, listParams),
    () => wellModesApi.getWellModes(branchId, listParams),
    {
      enabled: enabled && !!branchId,
      placeholderData: keepPrevious ? keepPreviousData : undefined,
    }
  );
};
