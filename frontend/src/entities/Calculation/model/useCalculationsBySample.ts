import { useAutoRefetchQuery } from '@/shared/model';
import { type Calculation, calculationApi, calculationKeys } from '../api';

/** Загружает расчёты по идентификатору пробы. */
export const useCalculationsBySample = (sampleId: number | undefined, enabled = true) => {
  const isQueryEnabled = enabled && sampleId != null;
  return useAutoRefetchQuery<Calculation[]>(
    calculationKeys.bySample(sampleId ?? 0),
    () => {
      if (sampleId == null) {
        return Promise.reject(new Error('Sample id is required'));
      }
      return calculationApi.getCalculationsBySample(sampleId);
    },
    { enabled: isQueryEnabled }
  );
};
