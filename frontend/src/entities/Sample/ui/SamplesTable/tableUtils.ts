import dayjs, { type Dayjs } from 'dayjs';

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

/** Проверяет, попадает ли дата строки в выбранный диапазон фильтра. */
export function matchesDateRange(value: unknown, filterValue: unknown): boolean {
  if (!filterValue) {
    return true;
  }
  if (!value) {
    return false;
  }

  const rowDate = dayjs(value as string);

  if (Array.isArray(filterValue) && filterValue.length === 2) {
    const [startDate, endDate] = filterValue as [Dayjs | null, Dayjs | null];
    if (!startDate || !endDate) {
      return true;
    }

    const start = startDate.startOf('day');
    const end = endDate.endOf('day');
    return (
      (rowDate.isSame(start, 'day') || rowDate.isAfter(start)) &&
      (rowDate.isSame(end, 'day') || rowDate.isBefore(end))
    );
  }

  return true;
}
