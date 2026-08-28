import { formatFontSizeLabel, normalizeFontStyle, normalizeFontWeight } from './cellStyleFormat';
import type { CellStyle } from '../api';

type RawCellStyle = Record<string, unknown>;

/** Привести стиль ячейки к camelCase (API / legacy snake_case). */
export function normalizeCellStyle(raw: RawCellStyle | CellStyle | null | undefined): CellStyle {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const record = raw as RawCellStyle;
  const textAlign = record.textAlign ?? record.text_align;
  const fontFamily = record.fontFamily ?? record.font_family;
  const fontWeight = normalizeFontWeight(record.fontWeight ?? record.font_weight);
  const fontStyle = normalizeFontStyle(record.fontStyle ?? record.font_style);
  const rawFontSize = record.fontSize ?? record.font_size;

  return {
    fontWeight,
    fontStyle,
    fontSize:
      typeof rawFontSize === 'string' || typeof rawFontSize === 'number'
        ? formatFontSizeLabel(String(rawFontSize))
        : undefined,
    fontFamily: typeof fontFamily === 'string' && fontFamily.trim() ? fontFamily.trim() : undefined,
    textAlign:
      textAlign === 'left' || textAlign === 'center' || textAlign === 'right'
        ? textAlign
        : undefined,
  };
}

/** Нормализовать словарь стилей секции Excel-шаблона. */
export function normalizeCellStyles(
  styles: Record<string, RawCellStyle | CellStyle> | null | undefined
): Record<string, CellStyle> {
  if (!styles) {
    return {};
  }
  const normalized: Record<string, CellStyle> = {};
  for (const [key, value] of Object.entries(styles)) {
    normalized[key] = normalizeCellStyle(value);
  }
  return normalized;
}
