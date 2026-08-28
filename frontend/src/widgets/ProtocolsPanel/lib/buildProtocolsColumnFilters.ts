import dayjs from 'dayjs';
import { urlParamsToFilters } from '@/shared/lib/routing';
import type { ColumnFiltersState } from '@tanstack/react-table';

export const PROTOCOL_FILTER_KEYS = [
  'test_protocol_number',
  'sampling_act_number',
  'is_accredited',
  'search_samples',
  'test_protocol_date_from',
  'test_protocol_date_to',
  'created_at_from',
  'created_at_to',
];

export function buildProtocolsColumnFilters(searchParams: URLSearchParams): ColumnFiltersState {
  const urlFilters = urlParamsToFilters(searchParams, PROTOCOL_FILTER_KEYS);
  const columnFilters: ColumnFiltersState = [];

  if (urlFilters.test_protocol_number && typeof urlFilters.test_protocol_number === 'string') {
    columnFilters.push({ id: 'test_protocol_number', value: urlFilters.test_protocol_number });
  }
  if (urlFilters.sampling_act_number && typeof urlFilters.sampling_act_number === 'string') {
    columnFilters.push({ id: 'sampling_act_number', value: urlFilters.sampling_act_number });
  }
  if (urlFilters.search_samples && typeof urlFilters.search_samples === 'string') {
    columnFilters.push({ id: 'samples_data', value: urlFilters.search_samples });
  }
  if (urlFilters.is_accredited !== undefined && urlFilters.is_accredited !== null) {
    const isAccreditedValue =
      (typeof urlFilters.is_accredited === 'string' &&
        (urlFilters.is_accredited === 'true' || urlFilters.is_accredited === '1')) ||
      (Array.isArray(urlFilters.is_accredited) &&
        urlFilters.is_accredited.length > 0 &&
        (urlFilters.is_accredited[0] === 'true' || urlFilters.is_accredited[0] === '1'));
    columnFilters.push({ id: 'is_accredited', value: isAccreditedValue });
  }

  const testProtocolFrom = urlFilters.test_protocol_date_from;
  const testProtocolTo = urlFilters.test_protocol_date_to;
  if (testProtocolFrom || testProtocolTo) {
    const startDate =
      testProtocolFrom && typeof testProtocolFrom === 'string' ? dayjs(testProtocolFrom) : null;
    const endDate =
      testProtocolTo && typeof testProtocolTo === 'string' ? dayjs(testProtocolTo) : null;
    if (startDate || endDate) {
      columnFilters.push({ id: 'test_protocol_date', value: [startDate, endDate] });
    }
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
