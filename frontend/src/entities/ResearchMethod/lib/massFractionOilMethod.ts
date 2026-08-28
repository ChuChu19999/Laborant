/** Совпадает с группой методов на бэкенде и в калькуляторе. */
export const MASS_FRACTION_OIL_GROUP_NAME = 'Массовая доля нефти';

type MethodLike = {
  name?: string;
  groups?: { name: string }[];
};

/** Проверяет, относится ли метод к группе «Массовая доля нефти». */
export function isMassFractionOilResearchMethod(method: MethodLike | null | undefined): boolean {
  if (!method) {
    return false;
  }
  if (method.name?.trim() === MASS_FRACTION_OIL_GROUP_NAME) {
    return true;
  }
  return method.groups?.some(g => g.name.trim() === MASS_FRACTION_OIL_GROUP_NAME) ?? false;
}
