import type { MonitoringErrorFilters } from '@/entities/Monitoring';
import type { ColumnFiltersState } from '@tanstack/react-table';

const readStringFilter = (columnFilters: ColumnFiltersState, id: string): string => {
  const filter = columnFilters.find(item => item.id === id);
  return filter && typeof filter.value === 'string' ? filter.value.trim() : '';
};

const readOccurrenceCountFilter = (columnFilters: ColumnFiltersState): number | undefined => {
  const raw = readStringFilter(columnFilters, 'occurrence_count');
  if (!raw || !/^\d+$/.test(raw)) {
    return undefined;
  }
  const value = Number.parseInt(raw, 10);
  return value >= 1 ? value : undefined;
};

/** Преобразовать фильтры колонок таблицы в параметры API списка ошибок. */
export function columnFiltersToMonitoringFilters(
  columnFilters: ColumnFiltersState
): Omit<MonitoringErrorFilters, 'period'> {
  const severityRaw = readStringFilter(columnFilters, 'severity');
  const sourceRaw = readStringFilter(columnFilters, 'source');
  const searchRaw = readStringFilter(columnFilters, 'summary');
  const resolvedRaw = readStringFilter(columnFilters, 'resolved');
  const appVersionRaw = readStringFilter(columnFilters, 'app_version');
  const lastSeenRaw = readStringFilter(columnFilters, 'last_seen_at');

  let resolved: boolean | undefined;
  if (resolvedRaw === 'open') {
    resolved = false;
  } else if (resolvedRaw === 'closed') {
    resolved = true;
  }

  return {
    severity:
      severityRaw === 'warning' || severityRaw === 'error' || severityRaw === 'critical'
        ? severityRaw
        : undefined,
    source: sourceRaw === 'backend' || sourceRaw === 'frontend' ? sourceRaw : undefined,
    search: searchRaw || undefined,
    occurrence_count: readOccurrenceCountFilter(columnFilters),
    app_version: appVersionRaw || undefined,
    last_seen: lastSeenRaw || undefined,
    resolved,
  };
}
