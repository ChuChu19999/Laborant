import dayjs from 'dayjs';
import { urlFilterValueToStringArray, urlParamsToFilters } from '@/shared/lib/routing';
import type { ColumnFiltersState } from '@tanstack/react-table';

export const ND_NORM_FILTER_KEYS = [
  'name',
  'test_object',
  'test_objects',
  'created_at_from',
  'created_at_to',
];

export function buildNdNormsColumnFilters(searchParams: URLSearchParams): ColumnFiltersState {
  const urlFilters = urlParamsToFilters(searchParams, ND_NORM_FILTER_KEYS);
  const columnFilters: ColumnFiltersState = [];

  if (urlFilters.name && typeof urlFilters.name === 'string') {
    columnFilters.push({ id: 'name', value: urlFilters.name });
  }

  const testObjectArray = urlFilterValueToStringArray(
    urlFilters.test_objects,
    urlFilters.test_object
  );
  if (testObjectArray.length > 0) {
    columnFilters.push({ id: 'test_object', value: testObjectArray });
  }

  const createdFrom = urlFilters.created_at_from;
  const createdTo = urlFilters.created_at_to;
  if (createdFrom || createdTo) {
    const startDate = createdFrom && typeof createdFrom === 'string' ? dayjs(createdFrom) : null;
    const endDate = createdTo && typeof createdTo === 'string' ? dayjs(createdTo) : null;
    if (startDate || endDate) {
      columnFilters.push({ id: 'created_at', value: [startDate, endDate] });
    }
  }

  return columnFilters;
}
