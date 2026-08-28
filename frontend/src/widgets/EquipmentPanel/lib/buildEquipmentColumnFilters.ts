import dayjs from 'dayjs';
import { urlParamsToFilters } from '@/shared/lib/routing';
import type { ColumnFiltersState } from '@tanstack/react-table';

export const EQUIPMENT_FILTER_KEYS = [
  'name',
  'serial_number',
  'type',
  'types',
  'verification_date_from',
  'verification_date_to',
  'verification_end_date_from',
  'verification_end_date_to',
  'created_at_from',
  'created_at_to',
];

/** Ключи фильтров для URL sync (без types и verification_date_* — как в исходной панели). */
export const EQUIPMENT_URL_SYNC_FILTER_KEYS = [
  'name',
  'serial_number',
  'type',
  'verification_end_date_from',
  'verification_end_date_to',
  'created_at_from',
  'created_at_to',
];

export function buildEquipmentColumnFilters(searchParams: URLSearchParams): ColumnFiltersState {
  const urlFilters = urlParamsToFilters(searchParams, EQUIPMENT_FILTER_KEYS);
  const columnFilters: ColumnFiltersState = [];

  if (urlFilters.name && typeof urlFilters.name === 'string') {
    columnFilters.push({ id: 'name', value: urlFilters.name });
  }
  if (urlFilters.serial_number && typeof urlFilters.serial_number === 'string') {
    columnFilters.push({ id: 'serial_number', value: urlFilters.serial_number });
  }
  if (urlFilters.type || urlFilters.types) {
    const typeArray = Array.isArray(urlFilters.types)
      ? urlFilters.types
      : Array.isArray(urlFilters.type)
        ? urlFilters.type
        : urlFilters.type
          ? [urlFilters.type]
          : [];
    if (typeArray.length > 0) {
      columnFilters.push({ id: 'type', value: typeArray });
    }
  }

  const verificationFrom = urlFilters.verification_date_from;
  const verificationTo = urlFilters.verification_date_to;
  if (verificationFrom || verificationTo) {
    const startDate =
      verificationFrom && typeof verificationFrom === 'string' ? dayjs(verificationFrom) : null;
    const endDate =
      verificationTo && typeof verificationTo === 'string' ? dayjs(verificationTo) : null;
    if (startDate || endDate) {
      columnFilters.push({ id: 'verification_date', value: [startDate, endDate] });
    }
  }

  const verificationEndFrom = urlFilters.verification_end_date_from;
  const verificationEndTo = urlFilters.verification_end_date_to;
  if (verificationEndFrom || verificationEndTo) {
    const startDate =
      verificationEndFrom && typeof verificationEndFrom === 'string'
        ? dayjs(verificationEndFrom)
        : null;
    const endDate =
      verificationEndTo && typeof verificationEndTo === 'string' ? dayjs(verificationEndTo) : null;
    if (startDate || endDate) {
      columnFilters.push({ id: 'verification_end_date', value: [startDate, endDate] });
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
