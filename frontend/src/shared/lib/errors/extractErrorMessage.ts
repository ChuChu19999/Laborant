import { AxiosError } from 'axios';

/**
 * Извлекает детальное сообщение об ошибке из ответа сервера
 * @param error - ошибка (обычно AxiosError)
 * @param defaultMessage - сообщение по умолчанию, если не удалось извлечь
 * @returns детальное сообщение об ошибке
 */
export const extractErrorMessage = (error: unknown, defaultMessage: string): string => {
  if (error instanceof AxiosError && error.response?.data) {
    const detail = error.response.data.detail;

    if (typeof detail === 'string') {
      return detail;
    }

    if (Array.isArray(detail)) {
      // Если detail - массив (ошибки валидации), берем первое сообщение
      const firstError = detail[0];
      if (firstError?.msg) {
        return firstError.msg;
      }
      if (typeof firstError === 'string') {
        return firstError;
      }
    }

    // Если есть общее сообщение об ошибке
    if (error.response.data.message && typeof error.response.data.message === 'string') {
      return error.response.data.message;
    }
  }

  return defaultMessage;
};
