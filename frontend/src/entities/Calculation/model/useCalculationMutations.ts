import { extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';
import { useAutoInvalidateMutation } from '@/shared/model';
import {
  type CalculateRequest,
  type Calculation,
  calculationApi,
  calculationKeys,
  type CalculationResult,
} from '../api';

/** Выполняет расчёт по методике. */
export const useCalculate = () => {
  return useAutoInvalidateMutation<CalculationResult, unknown, CalculateRequest>(
    data => calculationApi.calculate(data),
    [],
    {
      onError: (error: unknown) => {
        const errorMessage = extractErrorMessage(error, 'Ошибка при расчёте');
        notify.error(errorMessage);
      },
    }
  );
};

/** Создаёт расчёт. */
export const useCreateCalculation = () => {
  return useAutoInvalidateMutation<
    Calculation,
    unknown,
    Parameters<typeof calculationApi.createCalculation>[0]
  >(data => calculationApi.createCalculation(data), [calculationKeys.all], {
    onSuccess: () => {
      notify.success('Результат расчёта успешно сохранён');
    },
  });
};

/** Заменяет расчёт новой версией. */
export const useReplaceCalculation = () => {
  return useAutoInvalidateMutation<
    Calculation,
    unknown,
    { id: number; data: Parameters<typeof calculationApi.replaceCalculation>[1] }
  >(({ id, data }) => calculationApi.replaceCalculation(id, data), [calculationKeys.all], {
    onSuccess: () => {
      notify.success('Расчёт успешно заменён');
    },
  });
};

/** Удаляет расчёт. */
export const useDeleteCalculation = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => calculationApi.deleteCalculation(id),
    [calculationKeys.all],
    {
      onSuccess: () => {
        notify.success('Расчёт успешно удалён');
      },
    }
  );
};
