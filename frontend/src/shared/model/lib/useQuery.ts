import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

/**
 * Универсальный хук для получения данных с автоматическим обновлением
 * @param queryKey - ключ запроса (массив)
 * @param queryFn - функция для получения данных
 * @param options - дополнительные опции
 */
export const useAutoRefetchQuery = <TData = unknown, TError = unknown>(
  queryKey: unknown[],
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
