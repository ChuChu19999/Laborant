import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type MonitoringPeriod,
  useCleanupClosedMonitoringErrors,
  useMonitoring,
  useMonitoringOverview,
  useUpdateMonitoringErrorStatus,
} from '@/entities/Monitoring';
import { buildMonitoringColumnFilters } from '../lib/buildMonitoringColumnFilters';
import { columnFiltersToMonitoringFilters } from '../lib/columnFiltersToMonitoringFilters';
import { useMonitoringPanelModals } from './useMonitoringPanelModals';
import { useMonitoringPanelQuerySync } from './useMonitoringPanelQuerySync';
import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table';

/** Оркестрация экрана мониторинга: URL sync, сводка, таблица ошибок, модалки. */
export const useMonitoringPanel = () => {
  const navigate = useNavigate();
  const { searchParams } = useMonitoringPanelQuerySync();
  const monitoring = useMonitoring();
  const modals = useMonitoringPanelModals();
  const [tableKey, setTableKey] = useState(0);

  const period = monitoring.filters.period;
  const overviewQuery = useMonitoringOverview(period);
  const statusMutation = useUpdateMonitoringErrorStatus();
  const cleanupMutation = useCleanupClosedMonitoringErrors();

  const defaultPeriod = overviewQuery.data?.default_period ?? '24h';
  const periodOptions = overviewQuery.data?.period_options ?? [];

  const selectedError = useMemo(() => {
    if (modals.selectedErrorId == null) {
      return null;
    }
    return monitoring.data.find(item => item.id === modals.selectedErrorId) ?? null;
  }, [modals.selectedErrorId, monitoring.data]);

  const initialColumnFilters = useMemo(
    () => buildMonitoringColumnFilters(searchParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при remount таблицы
    [tableKey]
  );

  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: monitoring.page - 1,
      pageSize: monitoring.pageSize,
    }),
    [monitoring.page, monitoring.pageSize]
  );

  const totalPages = Math.max(1, Math.ceil(monitoring.total / monitoring.pageSize));

  const tableSorting: SortingState = monitoring.sorting?.sort_by
    ? [
        {
          id: monitoring.sorting.sort_by,
          desc: monitoring.sorting.sort_order === 'desc',
        },
      ]
    : [];

  const breadcrumbs = useMemo(
    () => [
      {
        label: 'Главная',
        onClick: () => {
          void navigate('/');
        },
      },
      { label: 'Мониторинг' },
    ],
    [navigate]
  );

  const navigateHome = () => {
    void navigate('/');
  };

  const handlePaginationChange = useCallback(
    (updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      if (next.pageSize !== pagination.pageSize) {
        monitoring.setPageSize(next.pageSize);
      }
      if (next.pageIndex !== pagination.pageIndex) {
        monitoring.setPage(next.pageIndex + 1);
      }
    },
    [monitoring, pagination]
  );

  const handleFiltersChange = useCallback(
    (columnFilters: ColumnFiltersState) => {
      monitoring.setFilters({
        ...columnFiltersToMonitoringFilters(columnFilters),
        period,
      });
    },
    [monitoring, period]
  );

  const handleSortingChange = useCallback(
    (sortingState: SortingState) => {
      const sort = sortingState[0];
      if (sort) {
        monitoring.setSorting({
          sort_by: sort.id,
          sort_order: sort.desc ? 'desc' : 'asc',
        });
      } else {
        monitoring.setSorting(undefined);
      }
    },
    [monitoring]
  );

  const handlePeriodChange = useCallback(
    (nextPeriod: MonitoringPeriod) => {
      monitoring.setFilters({
        ...monitoring.filters,
        period: nextPeriod,
      });
    },
    [monitoring]
  );

  const handleResetFilters = () => {
    monitoring.setFilters({ period: defaultPeriod });
    monitoring.setSorting(undefined);
    monitoring.setPage(1);
    setTableKey(key => key + 1);
  };

  const confirmStatusChange = (comment: string) => {
    if (!modals.statusAction) {
      return;
    }
    const trimmedComment = comment.trim();
    statusMutation.mutate(
      {
        errorId: modals.statusAction.errorId,
        resolved: modals.statusAction.resolved,
        comment: trimmedComment || null,
      },
      {
        onSuccess: () => {
          modals.setStatusAction(null);
        },
      }
    );
  };

  const confirmCleanupClosed = () => {
    cleanupMutation.mutate(undefined, {
      onSuccess: () => {
        modals.setCleanupConfirmOpen(false);
      },
    });
  };

  return {
    overviewQuery,
    monitoring,
    statusMutation,
    cleanupMutation,
    modals,
    selectedError,
    period,
    periodOptions,
    defaultPeriod,
    breadcrumbs,
    navigateHome,
    pagination,
    totalPages,
    tableKey,
    initialColumnFilters,
    tableSorting,
    handlePaginationChange,
    handleFiltersChange,
    handleSortingChange,
    handlePeriodChange,
    handleResetFilters,
    confirmStatusChange,
    confirmCleanupClosed,
  };
};
