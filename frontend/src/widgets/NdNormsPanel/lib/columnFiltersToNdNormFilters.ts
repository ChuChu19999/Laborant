import dayjs from 'dayjs';
import { toDisplayString } from '@/shared/lib/formatting';
import type { NdNormFilters } from '@/entities/NdNorm';
import type { ColumnFiltersState } from '@tanstack/react-table';
import type { Dayjs } from 'dayjs';

/** Преобразует фильтры колонок TanStack Table в параметры API списка норм НД. */
export function columnFiltersToNdNormFilters(columnFilters: ColumnFiltersState): NdNormFilters {
  const newFilters: NdNormFilters = {};

  columnFilters.forEach(filter => {
    const filterValue = filter.value;

    if (filter.id === 'name' && filterValue) {
      newFilters.name = toDisplayString(filterValue);
    } else if (filter.id === 'test_object' && filterValue) {
      if (Array.isArray(filterValue) && filterValue.length > 0) {
        newFilters.test_objects = filterValue as string[];
      } else if (typeof filterValue === 'string') {
        newFilters.test_object = filterValue;
      }
    } else if (filter.id === 'created_at' && filterValue) {
      if (Array.isArray(filterValue) && filterValue.length === 2) {
        const [start, end] = filterValue as [Dayjs | null, Dayjs | null];
        if (start && dayjs.isDayjs(start)) {
          newFilters.created_at_from = start.format('YYYY-MM-DD');
        }
        if (end && dayjs.isDayjs(end)) {
          newFilters.created_at_to = end.format('YYYY-MM-DD');
        }
      }
    }
  });

  return newFilters;
}
