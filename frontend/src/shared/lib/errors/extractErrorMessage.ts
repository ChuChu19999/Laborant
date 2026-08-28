import { isAxiosError, AxiosError } from 'axios';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Извлекает детальное сообщение об ошибке из ответа сервера. */
export const extractErrorMessage = (error: unknown, defaultMessage: string): string => {
  if (!isAxiosError(error) && !(error instanceof AxiosError)) {
    return defaultMessage;
  }

  const data: unknown = error.response?.data;
  if (!isRecord(data)) {
    return defaultMessage;
  }

  const detail: unknown = data.detail;

  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    const firstError: unknown = detail[0];
    if (isRecord(firstError) && typeof firstError.msg === 'string') {
      return firstError.msg;
    }
    if (typeof firstError === 'string') {
      return firstError;
    }
  }

  if (typeof data.message === 'string') {
    return data.message;
  }

  return defaultMessage;
};
