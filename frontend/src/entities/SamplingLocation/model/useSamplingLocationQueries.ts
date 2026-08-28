import { keepPreviousData } from '@tanstack/react-query';
import { useAutoRefetchQuery } from '@/shared/model';
import { type SamplingLocation, samplingLocationKeys, samplingLocationsApi } from '../api';

export interface SamplingLocationListParams {
  search?: string;
  sort_by?: string;
  sort_order?: string;
}

const DEFAULT_SAMPLING_LOCATION_LIST_PARAMS: SamplingLocationListParams = {
  sort_by: 'name',
  sort_order: 'asc',
};

/** Загружает места отбора проб по филиалу. */
export const useSamplingLocationsByBranch = (
  branchId: number | undefined,
  enabled = true,
  params: SamplingLocationListParams = DEFAULT_SAMPLING_LOCATION_LIST_PARAMS,
  keepPrevious = true
) => {
  const listParams = { ...DEFAULT_SAMPLING_LOCATION_LIST_PARAMS, ...params };

  return useAutoRefetchQuery<{ items: SamplingLocation[] }>(
    samplingLocationKeys.list(branchId, listParams),
    () => samplingLocationsApi.getSamplingLocations(branchId, listParams),
    {
      enabled: enabled && !!branchId,
      placeholderData: keepPrevious ? keepPreviousData : undefined,
    }
  );
};
