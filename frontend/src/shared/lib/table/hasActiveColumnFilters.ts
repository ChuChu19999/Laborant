import type { ColumnFiltersState } from '@tanstack/react-table';

/** Проверяет, есть ли активные фильтры колонок таблицы. */
export function hasActiveColumnFilters(filters: ColumnFiltersState): boolean {
  return filters.some(filter => {
    const value = filter.value;
    if (value == null || value === '') {
      return false;
    }
    if (Array.isArray(value)) {
      return value.some(item => item != null && item !== '');
    }
    return true;
  });
}
