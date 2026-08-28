import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

/** Запрос данных с автообновлением через React Query. */
export const useAutoRefetchQuery = <TData = unknown, TError = unknown>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) => {
  return useQuery<TData, TError>({
    queryKey,
    queryFn,
    staleTime: 10 * 1000, // Данные считаются свежими 10 секунд
    gcTime: 5 * 60 * 1000, // Кэш хранится 5 минут
    refetchInterval: 30 * 1000, // Автообновление каждые 30 секунд
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    ...options,
  });
};
