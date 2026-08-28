import { toDisplayString } from '@/shared/lib/formatting';

/** Название методики массовой концентрации хлористых солей. */
export const CHLORIDE_SALTS_METHOD_NAME = 'Массовая концентрация хлористых солей';

/** Ключ отображаемого результата хлористых солей в input_data. */
export const CHLORIDE_SALTS_RESULT_DISPLAY_KEY = '_chloride_salts_result_display';

type MethodLike = {
  name?: string;
};

/** Проверяет, что методика — массовая концентрация хлористых солей. */
export function isChlorideSaltsResearchMethod(method: MethodLike | null | undefined): boolean {
  return (method?.name || '').trim() === CHLORIDE_SALTS_METHOD_NAME;
}

/** Извлекает отображаемую подпись результата хлористых солей из input_data. */
export function getChlorideSaltsResultDisplay(
  inputData: Record<string, unknown> | null | undefined
): string | undefined {
  if (!inputData) {
    return undefined;
  }
  const label = inputData[CHLORIDE_SALTS_RESULT_DISPLAY_KEY];
  if (label === null || label === undefined) {
    return undefined;
  }
  const text = toDisplayString(label).trim();
  return text || undefined;
}
