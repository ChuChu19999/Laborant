import { message } from 'antd';
import {
  calculationApi,
  type CalculateRequest,
  type CalculationResult,
} from '../../api/calculation';
import { extractErrorMessage } from '../../lib/errors/extractErrorMessage';
import { useAutoInvalidateMutation } from '../lib/useMutation';

/**
 * Хук для выполнения расчета
 */
export const useCalculate = () => {
  return useAutoInvalidateMutation<CalculationResult, unknown, CalculateRequest>(
    data => calculationApi.calculate(data),
    [],
    {
      onError: (error: unknown) => {
        const errorMessage = extractErrorMessage(error, 'Ошибка при расчете');
        message.error(errorMessage);
      },
    }
  );
};
