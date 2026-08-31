import { useAutoRefetchQuery } from '@/shared/model';
import { monitoringApi, monitoringKeys, type MonitoringPeriod } from '../api';

/** Загружает сводку мониторинга. */
export const useMonitoringOverview = (period: MonitoringPeriod = '24h') => {
  return useAutoRefetchQuery(
    monitoringKeys.overview(period),
    () => monitoringApi.getOverview(period),
    {
      staleTime: 15 * 1000,
      refetchInterval: 30 * 1000,
    }
  );
};
