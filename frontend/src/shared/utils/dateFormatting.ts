import dayjs from 'dayjs';

/**
 * Форматирует дату в формат DD.MM.YYYY для отображения.
 * @param dateString - Строка с датой или undefined.
 * @returns Отформатированная дата или '-', если дата не передана.
 */
export const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  return dayjs(dateString).format('DD.MM.YYYY');
};
