import { urlParamsToFilters } from '@/shared/lib/routing';
import type { ColumnFiltersState } from '@tanstack/react-table';

export const ROLE_FILTER_KEYS = ['search', 'name', 'role_type'];

export function buildRolesColumnFilters(searchParams: URLSearchParams): ColumnFiltersState {
  const urlFilters = urlParamsToFilters(searchParams, ['name', 'role_type']);
  const columnFilters: ColumnFiltersState = [];

  if (urlFilters.name && typeof urlFilters.name === 'string') {
    columnFilters.push({ id: 'name', value: urlFilters.name });
  }

  if (urlFilters.role_type && typeof urlFilters.role_type === 'string') {
    columnFilters.push({ id: 'role_type', value: urlFilters.role_type });
  }

  return columnFilters;
}
