/** Префикс номера скважины в месте отбора. */
export const WELL_DISPLAY_PREFIX = 'скв. №';

/** Форматирует скважину для отображения: «скв. №{номер}». */
export function formatWellDisplay(well: string | null | undefined): string | null {
  const value = well?.trim();
  if (!value) {
    return null;
  }
  return `${WELL_DISPLAY_PREFIX}${value}`;
}
