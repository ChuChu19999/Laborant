import {
  useTableFilterSelectPopup,
  type TableFilterSelectPopupApi,
} from './useTableFilterSelectPopup';
import type { ReactNode } from 'react';

type TableFilterCellProps = {
  columnIndex: number;
  columnCount: number;
  className?: string;
  children: (selectPopup: TableFilterSelectPopupApi) => ReactNode;
};

/** Ячейка строки фильтров таблицы с измерением ширины для popup Select. */
export function TableFilterCell({
  columnIndex,
  columnCount,
  className,
  children,
}: TableFilterCellProps) {
  const selectPopup = useTableFilterSelectPopup(columnIndex, columnCount);

  return (
    <th ref={selectPopup.cellRef} className={className}>
      {children(selectPopup)}
    </th>
  );
}
