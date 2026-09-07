import dayjs from 'dayjs';
import { urlParamsToFilters } from '@/shared/lib/routing';
import type { ColumnFiltersState } from '@tanstack/react-table';

export const MONITORING_FILTER_KEYS: string[] = [
  'severity',
  'source',
  'summary',
  'resolved',
  'app_version',
  'occurrence_count',
  'last_seen_at_from',
  'last_seen_at_to',
  'period',
];

/** Собрать начальные фильтры колонок таблицы из параметров URL. */
export function buildMonitoringColumnFilters(searchParams: URLSearchParams): ColumnFiltersState {
  const urlFilters = urlParamsToFilters(searchParams, MONITORING_FILTER_KEYS);
  const columnFilters: ColumnFiltersState = [];

  if (urlFilters.severity && typeof urlFilters.severity === 'string') {
    columnFilters.push({ id: 'severity', value: urlFilters.severity });
  }
  if (urlFilters.source && typeof urlFilters.source === 'string') {
    columnFilters.push({ id: 'source', value: urlFilters.source });
  }
  if (urlFilters.summary && typeof urlFilters.summary === 'string') {
    columnFilters.push({ id: 'summary', value: urlFilters.summary });
  }
  if (urlFilters.resolved && typeof urlFilters.resolved === 'string') {
    columnFilters.push({ id: 'resolved', value: urlFilters.resolved });
  }
  if (urlFilters.app_version && typeof urlFilters.app_version === 'string') {
    columnFilters.push({ id: 'app_version', value: urlFilters.app_version });
  }
  if (urlFilters.occurrence_count && typeof urlFilters.occurrence_count === 'string') {
    columnFilters.push({ id: 'occurrence_count', value: urlFilters.occurrence_count });
  }

  const lastSeenFrom = urlFilters.last_seen_at_from;
  const lastSeenTo = urlFilters.last_seen_at_to;
  if (lastSeenFrom || lastSeenTo) {
    const startDate = lastSeenFrom && typeof lastSeenFrom === 'string' ? dayjs(lastSeenFrom) : null;
    const endDate = lastSeenTo && typeof lastSeenTo === 'string' ? dayjs(lastSeenTo) : null;
    if (startDate || endDate) {
      columnFilters.push({ id: 'last_seen_at', value: [startDate, endDate] });
    }
  }

  return columnFilters;
}
