import dayjs from 'dayjs';
import { toDisplayString } from '@/shared/lib/formatting';
import type { EquipmentFilters } from '@/entities/Equipment';
import type { ColumnFiltersState } from '@tanstack/react-table';
import type { Dayjs } from 'dayjs';

/** Преобразует фильтры колонок TanStack Table в параметры API списка приборов. */
export function columnFiltersToEquipmentFilters(
  columnFilters: ColumnFiltersState
): EquipmentFilters {
  const newFilters: EquipmentFilters = {};

  columnFilters.forEach(filter => {
    const filterValue = filter.value;

    if (filter.id === 'name' && filterValue) {
      newFilters.name = toDisplayString(filterValue);
    } else if (filter.id === 'serial_number' && filterValue) {
      newFilters.serial_number = toDisplayString(filterValue);
    } else if (filter.id === 'type' && filterValue) {
      if (Array.isArray(filterValue) && filterValue.length > 0) {
        newFilters.types = filterValue as string[];
      } else if (typeof filterValue === 'string') {
        newFilters.type = filterValue;
      }
    } else if (filter.id === 'verification_date' && filterValue) {
      if (Array.isArray(filterValue) && filterValue.length === 2) {
        const [start, end] = filterValue as [Dayjs | null, Dayjs | null];
        if (start && dayjs.isDayjs(start)) {
          newFilters.verification_date_from = start.format('YYYY-MM-DD');
        }
        if (end && dayjs.isDayjs(end)) {
          newFilters.verification_date_to = end.format('YYYY-MM-DD');
        }
      }
    } else if (filter.id === 'verification_end_date' && filterValue) {
      if (Array.isArray(filterValue) && filterValue.length === 2) {
        const [start, end] = filterValue as [Dayjs | null, Dayjs | null];
        if (start && dayjs.isDayjs(start)) {
          newFilters.verification_end_date_from = start.format('YYYY-MM-DD');
        }
        if (end && dayjs.isDayjs(end)) {
          newFilters.verification_end_date_to = end.format('YYYY-MM-DD');
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
