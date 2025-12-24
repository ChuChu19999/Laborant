/**
 * Форматирует число для отображения, заменяя точку на запятую.
 * @param value - Число или строка для форматирования.
 * @returns Отформатированная строка с запятой вместо точки.
 */
export const formatNumberForDisplay = (value: string | number): string => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace('.', ',');
};
