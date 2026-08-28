import dayjs from 'dayjs';
import { toDisplayString } from '@/shared/lib/formatting';
import type { ProtocolFilters } from '@/entities/Protocol';
import type { ColumnFiltersState } from '@tanstack/react-table';
import type { Dayjs } from 'dayjs';

const normalizeProtocolSearchValue = (rawValue: string): { number?: string; date?: string } => {
  const value = rawValue.trim();
  if (!value) {
    return {};
  }

  const result: { number?: string; date?: string } = {};

  const numberMatch = value.match(/^(\d+)\s*[\\/]/);
  if (numberMatch && numberMatch[1]) {
    result.number = numberMatch[1];
  }

  const dateMatch = value.match(/(\d{2}\.\d{2}\.\d{4})/);
  if (dateMatch && dateMatch[1]) {
    result.date = dateMatch[1];
  }

  if (!result.number && !result.date) {
    result.number = value;
  }

  return result;
};

/** Преобразует фильтры колонок TanStack Table в параметры API списка протоколов. */
export function columnFiltersToProtocolFilters(columnFilters: ColumnFiltersState): ProtocolFilters {
  const newFilters: ProtocolFilters = {};

  columnFilters.forEach(filter => {
    const filterValue = filter.value;

    if (filter.id === 'test_protocol_number' && filterValue) {
      const normalized = normalizeProtocolSearchValue(toDisplayString(filterValue));
      if (normalized.number) {
        newFilters.test_protocol_number = normalized.number;
      }
      if (normalized.date) {
        const [day, month, year] = normalized.date.split('.');
        newFilters.test_protocol_date_search = `${year}-${month}-${day}`;
      }
    } else if (filter.id === 'sampling_act_number' && filterValue) {
      newFilters.sampling_act_number = toDisplayString(filterValue);
    } else if (filter.id === 'samples_data' && filterValue) {
      newFilters.search_samples = toDisplayString(filterValue);
    } else if (filter.id === 'test_protocol_date' && filterValue) {
      if (Array.isArray(filterValue) && filterValue.length === 2) {
        const [start, end] = filterValue as [Dayjs | null, Dayjs | null];
        if (start && dayjs.isDayjs(start)) {
          newFilters.test_protocol_date_from = start.format('YYYY-MM-DD');
        }
        if (end && dayjs.isDayjs(end)) {
          newFilters.test_protocol_date_to = end.format('YYYY-MM-DD');
        }
      }
    } else if (filter.id === 'is_accredited' && filterValue !== null && filterValue !== undefined) {
      newFilters.is_accredited = Boolean(filterValue);
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
