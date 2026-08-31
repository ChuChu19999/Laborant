import dayjs from 'dayjs';
import { Button } from '@/shared/ui/Button';
import { getMonitoringOptionLabel } from '../../lib/getMonitoringOptionLabel';
import type { MonitoringErrorItem, MonitoringOption } from '../../api';
import type { ColumnDef } from '@tanstack/react-table';

interface CreateMonitoringErrorsTableColumnsParams {
  onDetails: (item: MonitoringErrorItem) => void;
  onStatusChange: (errorId: number, resolved: boolean, comment?: string | null) => void;
  statusPendingErrorId?: number | null;
  severityOptions: MonitoringOption[];
  sourceOptions: MonitoringOption[];
}

const severityClass: Record<string, string> = {
  warning: 'monitoring-errors-severity-warning',
  error: 'monitoring-errors-severity-error',
  critical: 'monitoring-errors-severity-critical',
};

export function createMonitoringErrorsTableColumns({
  onDetails,
  onStatusChange,
  statusPendingErrorId,
  severityOptions,
  sourceOptions,
}: CreateMonitoringErrorsTableColumnsParams): ColumnDef<MonitoringErrorItem>[] {
  return [
    {
      accessorKey: 'severity',
      header: 'Уровень',
      cell: ({ row }) => {
        const label = getMonitoringOptionLabel(severityOptions, row.original.severity);
        return (
          <span
            className={`monitoring-errors-severity-badge ${severityClass[row.original.severity] ?? ''}`}
            title={label}
          >
            {label}
          </span>
        );
      },
      enableSorting: true,
      enableColumnFilter: true,
      size: 108,
      minSize: 96,
    },
    {
      accessorKey: 'source',
      header: 'Источник',
      cell: ({ row }) => getMonitoringOptionLabel(sourceOptions, row.original.source),
      enableSorting: true,
      enableColumnFilter: true,
      size: 88,
      minSize: 80,
    },
    {
      accessorKey: 'summary',
      header: 'Описание',
      cell: ({ row }) => (
        <span className="monitoring-errors-summary-cell" title={row.original.summary || undefined}>
          {row.original.summary || '-'}
        </span>
      ),
      enableSorting: false,
      enableColumnFilter: true,
      size: 280,
      minSize: 160,
    },
    {
      accessorKey: 'occurrence_count',
      header: 'Повторы',
      cell: ({ row }) => row.original.occurrence_count,
      enableSorting: true,
      enableColumnFilter: true,
      size: 72,
      minSize: 64,
    },
    {
      accessorKey: 'app_version',
      header: 'Версия',
      cell: ({ row }) => (
        <span
          className="monitoring-errors-version-cell"
          title={row.original.app_version || undefined}
        >
          {row.original.app_version || '—'}
        </span>
      ),
      enableSorting: false,
      enableColumnFilter: true,
      size: 72,
      minSize: 64,
    },
    {
      id: 'last_seen_at',
      accessorKey: 'last_seen_at',
      header: 'Последнее',
      cell: ({ row }) => dayjs(row.original.last_seen_at).format('DD.MM.YY HH:mm'),
      enableSorting: true,
      enableColumnFilter: true,
      size: 124,
      minSize: 112,
    },
    {
      id: 'resolved',
      accessorKey: 'resolved_at',
      header: 'Статус',
      cell: ({ row }) =>
        row.original.resolved_at ? (
          <span className="monitoring-errors-status monitoring-errors-status-resolved">
            Закрыта
          </span>
        ) : (
          <span className="monitoring-errors-status monitoring-errors-status-open">Открыта</span>
        ),
      enableSorting: true,
      enableColumnFilter: true,
      size: 92,
      minSize: 84,
    },
    {
      id: 'actions',
      header: 'Действия',
      cell: ({ row }) => {
        const isStatusPending = statusPendingErrorId === row.original.id;

        return (
          <div className="monitoring-errors-table-actions">
            <Button
              type="link"
              size="small"
              className="monitoring-errors-action-button"
              onClick={() => onDetails(row.original)}
            >
              Детали
            </Button>
            {row.original.resolved_at ? (
              <Button
                type="link"
                size="small"
                className="monitoring-errors-action-button"
                loading={isStatusPending}
                onClick={() => onStatusChange(row.original.id, false)}
              >
                Открыть
              </Button>
            ) : (
              <Button
                type="link"
                size="small"
                className="monitoring-errors-action-button"
                loading={isStatusPending}
                onClick={() => onStatusChange(row.original.id, true)}
              >
                Закрыть
              </Button>
            )}
          </div>
        );
      },
      enableSorting: false,
      enableColumnFilter: false,
      size: 88,
      minSize: 80,
    },
  ];
}
