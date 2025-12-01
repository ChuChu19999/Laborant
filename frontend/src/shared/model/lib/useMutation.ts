import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { message } from 'antd';
import { extractErrorMessage } from '../../lib/errors/extractErrorMessage';

/**
 * Универсальный хук для мутаций с автоматической инвалидацией кэша
 * @param mutationFn - функция мутации
 * @param invalidateQueries - ключи запросов для инвалидации (массив массивов)
 * @param options - опции мутации
 */
export const useAutoInvalidateMutation = <TData = unknown, TError = unknown, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  invalidateQueries: unknown[][] = [],
  options?: Omit<UseMutationOptions<TData, TError, TVariables, unknown>, 'mutationFn'>
) => {
  const queryClient = useQueryClient();

  return useMutation<TData, TError, TVariables, unknown>({
    mutationFn,
    onSuccess: (data, variables, context) => {
      // Инвалидируем все указанные запросы
      invalidateQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });

      // Вызываем пользовательский onSuccess если есть
      if (options?.onSuccess) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (options.onSuccess as any)(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      // Вызываем пользовательский onError если есть
      if (options?.onError) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (options.onError as any)(error, variables, context);
      } else {
        // По умолчанию показываем ошибку с детальным сообщением
        const errorMessage = extractErrorMessage(error, 'Произошла ошибка при выполнении операции');
        message.error(errorMessage);
      }
    },
    ...options,
  });
};
