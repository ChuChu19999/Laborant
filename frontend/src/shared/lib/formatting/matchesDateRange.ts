import dayjs, { type Dayjs } from 'dayjs';

/** Проверить, попадает ли дата строки в диапазон фильтра (границы независимы). */
export function matchesDateRange(value: unknown, filterValue: unknown): boolean {
  if (!filterValue) {
    return true;
  }
  if (!value) {
    return false;
  }
  if (!Array.isArray(filterValue) || filterValue.length !== 2) {
    return true;
  }

  const [startDate, endDate] = filterValue as [Dayjs | null, Dayjs | null];
  if (!startDate && !endDate) {
    return true;
  }

  const rowDate = dayjs(value as string);
  if (!rowDate.isValid()) {
    return false;
  }

  if (startDate) {
    const start = dayjs(startDate).startOf('day');
    if (start.isValid() && rowDate.isBefore(start, 'day')) {
      return false;
    }
  }
  if (endDate) {
    const end = dayjs(endDate).endOf('day');
    if (end.isValid() && rowDate.isAfter(end, 'day')) {
      return false;
    }
  }
  return true;
}
