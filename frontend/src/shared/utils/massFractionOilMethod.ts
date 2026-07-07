/** Совпадает с группой методов на бэкенде и в калькуляторе. */
export const MASS_FRACTION_OIL_GROUP_NAME = 'Массовая доля нефти';

type MethodLike = {
  name?: string;
  groups?: Array<{ name: string }>;
};

/**
 * Метод ведёт себя как «массовая доля нефти» (преломление, градуировочный график, поле Цвет),
 * если метод так назван или входит в группу с этим именем (например СНЕЛ-104 / RFM 340).
 */
export function isMassFractionOilResearchMethod(method: MethodLike | null | undefined): boolean {
  if (!method) {
    return false;
  }
  if (method.name?.trim() === MASS_FRACTION_OIL_GROUP_NAME) {
    return true;
  }
  return method.groups?.some(g => g.name.trim() === MASS_FRACTION_OIL_GROUP_NAME) ?? false;
}
