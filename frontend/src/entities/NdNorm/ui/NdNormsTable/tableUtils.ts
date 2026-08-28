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
