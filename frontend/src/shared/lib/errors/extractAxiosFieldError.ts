import { isAxiosError } from 'axios';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Извлекает первое строковое сообщение об ошибке поля из ответа axios. */
export const extractAxiosFieldError = (error: unknown, fieldName: string): string | null => {
  if (!isAxiosError(error)) {
    return null;
  }

  const data: unknown = error.response?.data;
  if (!isRecord(data) || Array.isArray(data)) {
    return null;
  }

  const field = data[fieldName];
  if (Array.isArray(field) && typeof field[0] === 'string') {
    return field[0];
  }

  return null;
};
