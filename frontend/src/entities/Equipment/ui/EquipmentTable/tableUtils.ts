import dayjs, { type Dayjs } from 'dayjs';
import type { Equipment } from '../../api';
import type { Row } from '@tanstack/react-table';

/** Возвращает значение RangePicker из фильтра колонки. */
export function getDateRangeFilterValue(filterValue: unknown): [Dayjs, Dayjs] | null {
  if (
    filterValue &&
    Array.isArray(filterValue) &&
    filterValue.length === 2 &&
    filterValue[0] &&
    filterValue[1]
  ) {
    return [dayjs(filterValue[0] as Dayjs), dayjs(filterValue[1] as Dayjs)];
  }
  return null;
}

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
  if (!filterValue) return true;
  const fieldValue = row.original[dateField];
  if (!fieldValue) return false;

  const rowDate = dayjs(fieldValue);

  if (Array.isArray(filterValue) && filterValue.length === 2) {
    const [startDate, endDate] = filterValue as [Dayjs | null, Dayjs | null];
    if (!startDate || !endDate) return true;

    const start = startDate.startOf('day');
    const end = endDate.endOf('day');
    return (
      (rowDate.isSame(start, 'day') || rowDate.isAfter(start)) &&
      (rowDate.isSame(end, 'day') || rowDate.isBefore(end))
    );
  }

  return true;
};
