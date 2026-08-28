/** Приводит неизвестное значение к строке для отображения. */
export function toDisplayString(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'symbol') {
    return value.description ?? '';
  }
  return '';
}

/** Нормализует строку ввода с десятичной запятой к точке. */
export function toNormalizedInputString(value: unknown): string {
  const raw = toDisplayString(value).trim();
  if (!raw) {
    return '';
  }
  return raw.replace(',', '.');
}
