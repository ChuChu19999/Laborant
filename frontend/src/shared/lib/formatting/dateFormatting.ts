import dayjs from 'dayjs';

/** Форматирует дату в DD.MM.YYYY для отображения. */
export const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  return dayjs(dateString).format('DD.MM.YYYY');
};
