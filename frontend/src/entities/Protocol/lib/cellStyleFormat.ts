import type { CellStyle } from '../api';

/** Нормализовать fontWeight из API / xlsx к 'bold' | 'normal' | undefined. */
export function normalizeFontWeight(raw: unknown): string | undefined {
  if (raw === true || raw === 'true' || raw === 'bold' || raw === '700' || raw === 700) {
    return 'bold';
  }
  if (raw === false || raw === 'normal' || raw === '400' || raw === 400) {
    return 'normal';
  }
  if (typeof raw === 'string') {
    return raw;
  }
  return undefined;
}

/** Нормализовать fontStyle к 'italic' | 'normal' | undefined. */
export function normalizeFontStyle(raw: unknown): string | undefined {
  if (raw === true || raw === 'true' || raw === 'italic' || raw === 'oblique') {
    return 'italic';
  }
  if (raw === false || raw === 'normal') {
    return 'normal';
  }
  if (typeof raw === 'string') {
    return raw;
  }
  return undefined;
}

export function isBoldStyle(style: CellStyle): boolean {
  return normalizeFontWeight(style.fontWeight) === 'bold';
}

export function isItalicStyle(style: CellStyle): boolean {
  const fontStyle = normalizeFontStyle(style.fontStyle);
  return fontStyle === 'italic' || fontStyle === 'oblique';
}

export function formatFontSizeLabel(fontSize?: string): string {
  if (!fontSize) {
    return '14px';
  }
  return fontSize.endsWith('px') ? fontSize : `${fontSize}px`;
}
