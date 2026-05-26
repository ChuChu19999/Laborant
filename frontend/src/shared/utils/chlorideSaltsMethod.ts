export const CHLORIDE_SALTS_METHOD_NAME = 'Массовая концентрация хлористых солей';
export const CHLORIDE_SALTS_RESULT_DISPLAY_KEY = '_chloride_salts_result_display';

type MethodLike = {
  name?: string;
};

export function isChlorideSaltsResearchMethod(method: MethodLike | null | undefined): boolean {
  return (method?.name || '').trim() === CHLORIDE_SALTS_METHOD_NAME;
}

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
  const text = String(label).trim();
  return text || undefined;
}
