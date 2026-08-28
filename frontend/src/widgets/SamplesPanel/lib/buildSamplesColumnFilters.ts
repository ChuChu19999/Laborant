import dayjs from 'dayjs';
import { urlFilterValueToStringArray, urlParamsToFilters } from '@/shared/lib/routing';
import type { ColumnFiltersState } from '@tanstack/react-table';

export const SAMPLE_FILTER_KEYS = [
  'registration_number',
  'sample_type',
  'sample_types',
  'test_object',
  'test_objects',
  'sampling_location',
  'protocols',
  'added_by',
  'sampling_date_from',
  'sampling_date_to',
  'receiving_date_from',
  'receiving_date_to',
  'created_at_from',
  'created_at_to',
];

export function buildSamplesColumnFilters(searchParams: URLSearchParams): ColumnFiltersState {
  const urlFilters = urlParamsToFilters(searchParams, SAMPLE_FILTER_KEYS);
  const columnFilters: ColumnFiltersState = [];

  if (urlFilters.registration_number && typeof urlFilters.registration_number === 'string') {
    columnFilters.push({ id: 'registration_number', value: urlFilters.registration_number });
  }
  const sampleTypeArray = urlFilterValueToStringArray(
    urlFilters.sample_types,
    urlFilters.sample_type
  );
  if (sampleTypeArray.length > 0) {
    columnFilters.push({ id: 'sample_type', value: sampleTypeArray });
  }
  const testObjectArray = urlFilterValueToStringArray(
    urlFilters.test_objects,
    urlFilters.test_object
  );
  if (testObjectArray.length > 0) {
    columnFilters.push({ id: 'test_object', value: testObjectArray });
  }
  if (urlFilters.sampling_location && typeof urlFilters.sampling_location === 'string') {
    columnFilters.push({ id: 'sampling_location', value: urlFilters.sampling_location });
  }
  if (urlFilters.protocols && typeof urlFilters.protocols === 'string') {
    columnFilters.push({ id: 'protocols', value: urlFilters.protocols });
  }
  if (urlFilters.added_by && typeof urlFilters.added_by === 'string') {
    columnFilters.push({ id: 'added_by', value: urlFilters.added_by });
  }

  const samplingFrom = urlFilters.sampling_date_from;
  const samplingTo = urlFilters.sampling_date_to;
  if (samplingFrom || samplingTo) {
    const startDate = samplingFrom && typeof samplingFrom === 'string' ? dayjs(samplingFrom) : null;
    const endDate = samplingTo && typeof samplingTo === 'string' ? dayjs(samplingTo) : null;
    if (startDate || endDate) {
      columnFilters.push({ id: 'sampling_date', value: [startDate, endDate] });
    }
  }

  const receivingFrom = urlFilters.receiving_date_from;
  const receivingTo = urlFilters.receiving_date_to;
  if (receivingFrom || receivingTo) {
    const startDate =
      receivingFrom && typeof receivingFrom === 'string' ? dayjs(receivingFrom) : null;
    const endDate = receivingTo && typeof receivingTo === 'string' ? dayjs(receivingTo) : null;
    if (startDate || endDate) {
      columnFilters.push({ id: 'receiving_date', value: [startDate, endDate] });
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
