import { matchesDateRange } from '@/shared/lib/formatting';
import type { Equipment } from '../../api';
import type { Row } from '@tanstack/react-table';

/** Возвращает человекочитаемое название типа прибора. */
export const formatEquipmentType = (type: string): string => {
  const types: Record<string, string> = {
    measuring_instrument: 'Средство измерения',
    test_equipment: 'Испытательное оборудование',
  };
  return types[type] || type;
};

/** Фильтрует строку таблицы по диапазону дат в указанном поле. */
export const dateRangeFilterFn = (
  row: Row<Equipment>,
  _id: string,
  filterValue: unknown,
  dateField: 'verification_date' | 'verification_end_date' | 'created_at'
): boolean => {
  return matchesDateRange(row.original[dateField], filterValue);
};
