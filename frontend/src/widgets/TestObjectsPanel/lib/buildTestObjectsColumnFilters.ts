import { urlParamsToFilters } from '@/shared/lib/routing';
import type { ColumnFiltersState } from '@tanstack/react-table';

export const TEST_OBJECT_FILTER_KEYS = ['search', 'name', 'tag'];

export function buildTestObjectsColumnFilters(searchParams: URLSearchParams): ColumnFiltersState {
  const urlFilters = urlParamsToFilters(searchParams, ['name', 'tag']);
  const columnFilters: ColumnFiltersState = [];

  if (urlFilters.name && typeof urlFilters.name === 'string') {
    columnFilters.push({ id: 'name', value: urlFilters.name });
  }

  if (urlFilters.tag && typeof urlFilters.tag === 'string') {
    columnFilters.push({ id: 'tag', value: urlFilters.tag });
  }

  return columnFilters;
}
