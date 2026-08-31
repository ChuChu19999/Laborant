import { useSearchParams } from 'react-router-dom';
import { useMonitoringQueryStore, type MonitoringErrorFilters } from '@/entities/Monitoring';
import { useUrlSync } from '@/shared/model';
import { MONITORING_FILTER_KEYS } from '../lib/buildMonitoringColumnFilters';

/** Синхронизирует параметры списка мониторинга между URL и Zustand-store. */
export const useMonitoringPanelQuerySync = () => {
  const [searchParams] = useSearchParams();
  const {
    monitoringQuery,
    setMonitoringPage,
    setMonitoringPageSize,
    setMonitoringFilters,
    setMonitoringSorting,
  } = useMonitoringQueryStore();

  useUrlSync<MonitoringErrorFilters>(
    {
      filterKeys: MONITORING_FILTER_KEYS,
      defaultPage: 1,
      defaultPageSize: 20,
    },
    {
      ...monitoringQuery,
      filters: monitoringQuery.filters,
    },
    {
      setPage: setMonitoringPage,
      setPageSize: setMonitoringPageSize,
      setFilters: setMonitoringFilters,
      setSorting: setMonitoringSorting,
    }
  );

  return { searchParams };
};
