import dayjs, { type Dayjs } from 'dayjs';

export type DateRangeFilterValue = [Dayjs | null, Dayjs | null];

const toDayjsOrNull = (value: unknown): Dayjs | null => {
  if (value == null || value === '') {
    return null;
  }
  const parsed = dayjs.isDayjs(value) ? value : dayjs(value as string | Date | number);
  return parsed.isValid() ? parsed : null;
};

/**
 * Вернуть значение RangePicker из фильтра колонки.
 * Границы независимы: допускается только «с» или только «по» (как в URL/API).
 */
export function getDateRangeFilterValue(filterValue: unknown): DateRangeFilterValue | null {
  if (!filterValue || !Array.isArray(filterValue) || filterValue.length !== 2) {
    return null;
  }
  const start = toDayjsOrNull(filterValue[0]);
  const end = toDayjsOrNull(filterValue[1]);
  if (!start && !end) {
    return null;
  }
  return [start, end];
}
