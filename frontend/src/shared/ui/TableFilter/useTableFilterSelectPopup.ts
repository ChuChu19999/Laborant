import { useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { CSSProperties, RefObject } from 'react';

export type TableFilterSelectPopupApi = {
  cellRef: RefObject<HTMLTableCellElement | null>;
  popupMatchSelectWidth: false;
  styles?: { popup: { root: CSSProperties } };
  classNames: { popup: { root: string } };
  wrapOpenChange: (onOpenChange?: (open: boolean) => void) => (open: boolean) => void;
};

function computePopupWidth(
  cell: HTMLTableCellElement,
  columnIndex: number,
  columnCount: number
): { minWidth: number; maxWidth: number } {
  const currentWidth = cell.getBoundingClientRect().width;
  const row = cell.parentElement;
  if (!row || columnCount <= 1) {
    return { minWidth: currentWidth, maxWidth: currentWidth };
  }

  const cells = Array.from(row.children) as HTMLElement[];
  const isLastColumn = columnIndex >= columnCount - 1;
  const neighborIndex = isLastColumn ? columnIndex - 1 : columnIndex + 1;
  const neighborCell =
    neighborIndex >= 0 && neighborIndex < cells.length ? cells[neighborIndex] : undefined;
  const neighborWidth = neighborCell?.getBoundingClientRect().width ?? 0;

  return {
    minWidth: currentWidth,
    maxWidth: neighborCell ? currentWidth + neighborWidth : currentWidth,
  };
}

/** Ширина popup Select в фильтре: min = столбец, max = столбец + соседний (справа или слева для последнего). */
export function useTableFilterSelectPopup(
  columnIndex: number,
  columnCount: number
): TableFilterSelectPopupApi {
  const cellRef = useRef<HTMLTableCellElement>(null);
  const [popupRootStyle, setPopupRootStyle] = useState<CSSProperties | undefined>(undefined);

  const wrapOpenChange = useCallback(
    (onOpenChange?: (open: boolean) => void) => (open: boolean) => {
      if (open && cellRef.current) {
        const width = computePopupWidth(cellRef.current, columnIndex, columnCount);
        flushSync(() => {
          setPopupRootStyle({ minWidth: width.minWidth, maxWidth: width.maxWidth });
        });
      }
      onOpenChange?.(open);
    },
    [columnIndex, columnCount]
  );

  return {
    cellRef,
    popupMatchSelectWidth: false,
    styles: popupRootStyle ? { popup: { root: popupRootStyle } } : undefined,
    classNames: { popup: { root: 'table-filter-select-dropdown' } },
    wrapOpenChange,
  };
}
