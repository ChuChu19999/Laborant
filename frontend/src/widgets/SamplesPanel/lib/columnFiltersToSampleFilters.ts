import dayjs from 'dayjs';
import { toDisplayString } from '@/shared/lib/formatting';
import type { SampleFilters } from '@/entities/Sample';
import type { ColumnFiltersState } from '@tanstack/react-table';
import type { Dayjs } from 'dayjs';

/** Преобразует фильтры колонок TanStack Table в параметры API списка проб. */
export function columnFiltersToSampleFilters(columnFilters: ColumnFiltersState): SampleFilters {
  const newFilters: SampleFilters = {};

  columnFilters.forEach(filter => {
    const filterValue = filter.value;

    if (filter.id === 'registration_number' && filterValue) {
      newFilters.registration_number = toDisplayString(filterValue);
    } else if (filter.id === 'sample_type' && filterValue) {
      if (Array.isArray(filterValue) && filterValue.length > 0) {
        newFilters.sample_types = filterValue as string[];
      } else if (typeof filterValue === 'string') {
        newFilters.sample_type = filterValue;
      }
    } else if (filter.id === 'test_object' && filterValue) {
      if (Array.isArray(filterValue) && filterValue.length > 0) {
        newFilters.test_objects = filterValue as string[];
      } else if (typeof filterValue === 'string') {
        newFilters.test_object = filterValue;
      }
    } else if (filter.id === 'sampling_location' && filterValue) {
      newFilters.sampling_location = toDisplayString(filterValue);
    } else if (filter.id === 'protocols' && filterValue) {
      newFilters.protocols = toDisplayString(filterValue);
    } else if (filter.id === 'added_by' && filterValue) {
      newFilters.added_by = toDisplayString(filterValue);
    } else if (filter.id === 'sampling_date' && filterValue) {
      if (Array.isArray(filterValue) && filterValue.length === 2) {
        const [start, end] = filterValue as [Dayjs | null, Dayjs | null];
        if (start && dayjs.isDayjs(start)) {
          newFilters.sampling_date_from = start.format('YYYY-MM-DD');
        }
        if (end && dayjs.isDayjs(end)) {
          newFilters.sampling_date_to = end.format('YYYY-MM-DD');
        }
      }
    } else if (filter.id === 'receiving_date' && filterValue) {
      if (Array.isArray(filterValue) && filterValue.length === 2) {
        const [start, end] = filterValue as [Dayjs | null, Dayjs | null];
        if (start && dayjs.isDayjs(start)) {
          newFilters.receiving_date_from = start.format('YYYY-MM-DD');
        }
        if (end && dayjs.isDayjs(end)) {
          newFilters.receiving_date_to = end.format('YYYY-MM-DD');
        }
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
