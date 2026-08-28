/** Форматирует число для отображения, заменяя точку на запятую. */
export const formatNumberForDisplay = (value: string | number): string => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace('.', ',');
};
