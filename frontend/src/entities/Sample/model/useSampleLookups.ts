import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAutoRefetchQuery } from '@/shared/model';
import { type Sample, sampleKeys, samplesApi } from '../api';
import type { PaginatedResponse } from '@/shared/lib/http';

/** Императивные загрузки проб через React Query cache. */
export const useSampleQueries = () => {
  const queryClient = useQueryClient();

  const fetchSamplesByRegistrationNumber = useCallback(
    (registrationNumber: string, laboratoryId?: number, departmentId?: number) =>
      queryClient.fetchQuery<PaginatedResponse<Sample>>({
        queryKey: sampleKeys.list(
          laboratoryId,
          departmentId,
          1,
          100,
          { registration_number: registrationNumber },
          undefined
        ),
        queryFn: () =>
          samplesApi.getSamples(
            undefined,
            undefined,
            { registration_number: registrationNumber },
            undefined,
            laboratoryId,
            departmentId
          ),
      }),
    [queryClient]
  );

  return {
    fetchSamplesByRegistrationNumber,
  };
};

/** Загружает пробы для формы протокола. */
export const useSamplesForProtocol = (
  laboratoryId: number | undefined,
  departmentId: number | undefined,
  enabled = true
) => {
  return useAutoRefetchQuery<PaginatedResponse<Sample>>(
    sampleKeys.forProtocol(laboratoryId, departmentId),
    () =>
      samplesApi.getSamples(undefined, undefined, undefined, undefined, laboratoryId, departmentId),
    { enabled: enabled && !!laboratoryId }
  );
};

/** Загружает пробы для формы расчёта. */
export const useSamplesForCalculation = (
  laboratoryId: number | undefined,
  departmentId: number | undefined,
  enabled = true
) => {
  return useAutoRefetchQuery<PaginatedResponse<Sample>>(
    sampleKeys.forCalculation(laboratoryId, departmentId),
    () =>
      samplesApi.getSamples(undefined, undefined, undefined, undefined, laboratoryId, departmentId),
    { enabled: enabled && !!laboratoryId }
  );
};
