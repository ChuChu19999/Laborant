import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { extractErrorMessage } from '../../lib/errors';
import { notify } from '../../lib/notify';

/** Мутация с автоматической инвалидацией кэша React Query. */
export const useAutoInvalidateMutation = <TData = unknown, TError = unknown, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  invalidateQueries: readonly (readonly unknown[])[] = [],
  options?: Omit<UseMutationOptions<TData, TError, TVariables, unknown>, 'mutationFn'>
) => {
  const queryClient = useQueryClient();

  return useMutation<TData, TError, TVariables, unknown>({
    mutationFn,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateQueries.forEach(queryKey => {
        void queryClient.invalidateQueries({ queryKey });
      });

      void options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      if (options?.onError) {
        void options.onError(error, variables, onMutateResult, context);
      } else {
        const errorMessage = extractErrorMessage(error, 'Произошла ошибка при выполнении операции');
        notify.error(errorMessage);
      }
    },
  });
};
