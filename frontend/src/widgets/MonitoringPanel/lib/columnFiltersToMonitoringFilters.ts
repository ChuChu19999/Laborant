import dayjs, { type Dayjs } from 'dayjs';
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

const readLastSeenDateRange = (
  columnFilters: ColumnFiltersState
): { last_seen_at_from?: string; last_seen_at_to?: string } => {
  const filter = columnFilters.find(item => item.id === 'last_seen_at');
  if (!filter?.value || !Array.isArray(filter.value) || filter.value.length !== 2) {
    return {};
  }
  const [start, end] = filter.value as [Dayjs | null, Dayjs | null];
  const result: { last_seen_at_from?: string; last_seen_at_to?: string } = {};
  if (start && dayjs.isDayjs(start)) {
    result.last_seen_at_from = start.format('YYYY-MM-DD');
  }
  if (end && dayjs.isDayjs(end)) {
    result.last_seen_at_to = end.format('YYYY-MM-DD');
  }
  return result;
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
  const lastSeenRange = readLastSeenDateRange(columnFilters);

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
    ...lastSeenRange,
    resolved,
  };
}
