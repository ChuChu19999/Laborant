import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
  type OnChangeFn,
  type ColumnSizingState,
} from '@tanstack/react-table';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { TablePagination } from '@/shared/ui/TablePagination';
import { TableSortIcon } from '@/shared/ui/TableSortIcon';
import { createEquipmentTableColumns } from './equipmentTableColumns';
import { EquipmentTableFilterRow } from './equipmentTableFilterRow';
import type { Equipment } from '../../api';
import './EquipmentTable.css';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface EquipmentTableProps {
  data: Equipment[];
  loading?: boolean;
  pagination: PaginationState;
  totalPages: number;
  totalRecords: number;
  onPaginationChange: OnChangeFn<PaginationState>;
  onFiltersChange?: (filters: ColumnFiltersState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  sorting?: SortingState;
  onEdit: (equipmentId: number) => void;
  onDelete: (equipmentId: number) => void;
  initialColumnFilters?: ColumnFiltersState;
  canUpdate?: boolean;
  canDelete?: boolean;
}

const EquipmentTable = ({
  data,
  loading = false,
  pagination,
  totalPages,
  totalRecords,
  onPaginationChange,
  onFiltersChange,
  onSortingChange,
  sorting: externalSorting,
  onEdit,
  onDelete,
  initialColumnFilters,
  canUpdate = true,
  canDelete = true,
}: EquipmentTableProps) => {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(externalSorting || []);

  React.useEffect(() => {
    if (externalSorting !== undefined) {
      setInternalSorting(externalSorting);
    }
  }, [externalSorting]);

  const handleSortingChange = React.useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const newSorting = typeof updater === 'function' ? updater(internalSorting) : updater;
      setInternalSorting(newSorting);
      if (onSortingChange) {
        onSortingChange(newSorting);
      }
    },
    [internalSorting, onSortingChange]
  );

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    () => initialColumnFilters ?? []
  );

  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const tableRef = React.useRef<ReturnType<typeof useReactTable<Equipment>> | null>(null);

  const columns = React.useMemo(
    () =>
      createEquipmentTableColumns({
        canDelete,
        canUpdate,
        onDelete,
        onEdit,
      }),
    [onEdit, onDelete, canUpdate, canDelete]
  );

  const handleColumnFiltersChange = React.useCallback(
    (updater: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState)) => {
      setColumnFilters(old => {
        const newFilters = typeof updater === 'function' ? updater(old) : updater;
        return newFilters;
      });
    },
    []
  );

  const table = useReactTable<Equipment>({
    data,
    columns,
    pageCount: totalPages,
    state: {
      pagination,
      sorting: internalSorting,
      columnFilters,
      columnSizing,
    },
    onPaginationChange,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  });

  tableRef.current = table;

  const applyFilters = React.useCallback(() => {
    if (onFiltersChange && tableRef.current) {
      const currentFilters = tableRef.current.getState().columnFilters;
      onFiltersChange(currentFilters);
    }
  }, [onFiltersChange]);

  const applyFiltersWithNewValue = React.useCallback(
    (columnId: string, newValue: string[]) => {
      if (onFiltersChange && tableRef.current) {
        const currentFilters = tableRef.current.getState().columnFilters;
        const updatedFilters = currentFilters.filter(f => f.id !== columnId);
        if (newValue.length > 0) {
          updatedFilters.push({ id: columnId, value: newValue });
        }
        tableRef.current.setColumnFilters(updatedFilters);
        onFiltersChange(updatedFilters);
      }
    },
    [onFiltersChange]
  );

  return (
    <div className="equipment-table-container">
      <LoadingCard loading={loading} />
      {!loading && (
        <>
          <div className="equipment-table-wrapper">
            <table className="equipment-table">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <React.Fragment key={headerGroup.id}>
                    <tr className="equipment-table-header-row">
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          {...{ width: header.getSize() }}
                          className={header.column.getIsResizing() ? 'is-resizing' : ''}
                        >
                          {header.column.getCanSort() ? (
                            <button
                              type="button"
                              className="equipment-table-header-content sortable"
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <span className="equipment-table-sort-icon">
                                <TableSortIcon sorted={header.column.getIsSorted()} />
                              </span>
                            </button>
                          ) : (
                            <div className="equipment-table-header-content">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </div>
                          )}
                          {header.column.getCanResize() && (
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={`equipment-table-resizer ${
                                header.column.getIsResizing() ? 'isResizing' : ''
                              }`}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                    <EquipmentTableFilterRow
                      headers={headerGroup.headers}
                      applyFilters={applyFilters}
                      applyFiltersWithNewValue={applyFiltersWithNewValue}
                    />
                  </React.Fragment>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="equipment-table-empty-cell">
                      Приборы не найдены
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map(cell => (
                        <td
                          key={cell.id}
                          width={cell.column.getSize()}
                          className={cell.column.getIsResizing() ? 'is-resizing' : ''}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            shownCount={table.getRowModel().rows.length}
            totalRecords={totalRecords}
            pageIndex={pagination.pageIndex}
            pageCount={totalPages}
            pageSize={pagination.pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            canPreviousPage={table.getCanPreviousPage()}
            canNextPage={table.getCanNextPage()}
            onFirstPage={() => table.setPageIndex(0)}
            onPreviousPage={() => table.previousPage()}
            onNextPage={() => table.nextPage()}
            onLastPage={() => table.setPageIndex(totalPages - 1)}
            onPageSizeChange={size => table.setPageSize(size)}
          />
        </>
      )}
    </div>
  );
};

export default EquipmentTable;
