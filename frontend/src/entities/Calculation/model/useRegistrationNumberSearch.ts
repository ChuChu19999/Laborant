import { type Sample, sampleKeys, samplesApi } from '@/entities/Sample/@x/Calculation';
import { useAutoRefetchQuery } from '@/shared/model';

export interface RegistrationNumberOption {
  id: number;
  registration_number: string;
  test_object: string;
}

/** Поиск проб по регистрационному номеру в рамках лаборатории и методики. */
export const useRegistrationNumberSearch = (
  search: string,
  laboratoryId: number | undefined,
  departmentId: number | undefined,
  methodId: number | null | undefined,
  enabled = true
) => {
  const trimmedSearch = search.trim();
  const canSearch = !!laboratoryId && !!methodId && trimmedSearch.length >= 1;

  return useAutoRefetchQuery<{ samples: RegistrationNumberOption[] }>(
    sampleKeys.registrationNumbers(laboratoryId, departmentId, methodId, trimmedSearch),
    async () => {
      const response = await samplesApi.getRegistrationNumbers(
        laboratoryId,
        departmentId,
        methodId ?? undefined,
        trimmedSearch
      );

      const samples: RegistrationNumberOption[] = (response.samples ?? [])
        .slice(0, 10)
        .map((sample: Sample) => ({
          id: sample.id,
          registration_number: sample.registration_number,
          test_object: sample.test_object,
        }));

      return { samples };
    },
    {
      enabled: enabled && canSearch,
      refetchInterval: false,
      refetchOnWindowFocus: false,
    }
  );
};
