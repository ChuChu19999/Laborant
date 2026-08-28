import type { CSSProperties } from 'react';

const SELECT_CHROME_PX = 72;
const SELECT_DROPDOWN_SCROLLBAR_PX = 8;
const SELECT_FONT = '13px HeliosCondC, Arial, sans-serif';

let measureCanvas: HTMLCanvasElement | null = null;

export function measureTextWidth(text: string, font = SELECT_FONT): number {
  if (typeof document === 'undefined') {
    return text.length * 8;
  }
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas');
  }
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) {
    return text.length * 8;
  }
  ctx.font = font;
  return ctx.measureText(text).width;
}

export function getLongestLabelWidth(
  labels: (string | null | undefined)[],
  placeholder?: string
): number {
  let max = placeholder ? measureTextWidth(placeholder) : 0;
  for (const label of labels) {
    if (!label) continue;
    max = Math.max(max, measureTextWidth(label));
  }
  return Math.ceil(max + SELECT_CHROME_PX + SELECT_DROPDOWN_SCROLLBAR_PX);
}

export type FilterSelectExpandDirection = 'left' | 'right';

export type FilterSelectLayout = {
  columnWidth: number;
  neighborWidth: number;
  expandDirection: FilterSelectExpandDirection;
};

export function getFilterSelectLayout(columnWidths: number[], index: number): FilterSelectLayout {
  const columnWidth = columnWidths[index] ?? 0;
  const isLast = index >= columnWidths.length - 1;
  const neighborWidth = isLast
    ? (columnWidths[index - 1] ?? columnWidth)
    : (columnWidths[index + 1] ?? columnWidth);

  return {
    columnWidth,
    neighborWidth,
    expandDirection: isLast ? 'left' : 'right',
  };
}

export function getFilterSelectWidthStyle(params: {
  columnWidth: number;
  neighborWidth: number;
  expandDirection: FilterSelectExpandDirection;
  contentWidth: number;
}): CSSProperties {
  const { columnWidth, neighborWidth, expandDirection, contentWidth } = params;
  const maxWidth = Math.max(columnWidth + neighborWidth, columnWidth);
  const width = Math.min(Math.max(contentWidth, 0), maxWidth);

  const style: CSSProperties = {
    width,
    maxWidth,
    minWidth: Math.min(columnWidth, width),
  };

  if (expandDirection === 'left' && width > columnWidth) {
    style.marginLeft = columnWidth - width;
  }

  return style;
}
