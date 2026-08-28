import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAutoRefetchQuery } from '@/shared/model';
import { type Calculation, type MethodologyChoice, calculationApi, calculationKeys } from '../api';

/** Императивные загрузки расчётов через React Query cache. */
export const useCalculationQueries = () => {
  const queryClient = useQueryClient();

  const fetchCalculationsBySampleIds = useCallback(
    async (sampleIds: number[]) => {
      return Promise.all(
        sampleIds.map(sampleId =>
          queryClient.fetchQuery<Calculation[]>({
            queryKey: calculationKeys.bySample(sampleId),
            queryFn: () => calculationApi.getCalculationsBySample(sampleId),
          })
        )
      );
    },
    [queryClient]
  );

  return {
    fetchCalculationsBySampleIds,
  };
};

/** Загружает расчёт по идентификатору. */
export const useCalculation = (id: number | undefined, enabled = true) => {
  const isQueryEnabled = enabled && id != null;
  return useAutoRefetchQuery<Calculation>(
    calculationKeys.detail(id ?? 0),
    () => {
      if (id == null) {
        return Promise.reject(new Error('Calculation id is required'));
      }
      return calculationApi.getCalculation(id);
    },
    { enabled: isQueryEnabled }
  );
};

/** Загружает варианты выбора методики для редактирования расчёта. */
export const useMethodologyChoice = (calculationId: number | undefined, enabled = true) => {
  const isQueryEnabled = enabled && calculationId != null;
  return useAutoRefetchQuery<MethodologyChoice>(
    calculationKeys.methodologyChoice(calculationId ?? 0),
    () => {
      if (calculationId == null) {
        return Promise.reject(new Error('Calculation id is required'));
      }
      return calculationApi.getMethodologyChoice(calculationId);
    },
    { enabled: isQueryEnabled }
  );
};
