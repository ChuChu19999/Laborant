import React, { useState, useRef, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
  type OnChangeFn,
  type ColumnSizingState,
} from '@tanstack/react-table';
import { Input, Select } from 'antd';
import { BiChevronLeft, BiChevronRight, BiChevronsLeft, BiChevronsRight } from 'react-icons/bi';
import { FaSortUp, FaSortDown, FaSort } from 'react-icons/fa';
import { LoadingCard } from '../../../features/Cards';
import './DataTable.css';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  pagination: PaginationState;
  totalPages: number;
  totalRecords: number;
  onPaginationChange: OnChangeFn<PaginationState>;
  onFiltersChange?: (filters: ColumnFiltersState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  sorting?: SortingState;
}

function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  loading = false,
  pagination,
  totalPages,
  totalRecords,
  onPaginationChange,
  onFiltersChange,
  onSortingChange,
  sorting: externalSorting,
}: DataTableProps<T>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>(externalSorting || []);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const tableRef = useRef<ReturnType<typeof useReactTable<T>> | null>(null);

  React.useEffect(() => {
    if (externalSorting !== undefined) {
      setInternalSorting(externalSorting);
    }
  }, [externalSorting]);

  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const newSorting = typeof updater === 'function' ? updater(internalSorting) : updater;
      setInternalSorting(newSorting);
      if (onSortingChange) {
        onSortingChange(newSorting);
      }
    },
    [internalSorting, onSortingChange]
  );

  const table = useReactTable<T>({
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
    onColumnFiltersChange: setColumnFilters,
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

  const applyFilters = useCallback(() => {
    if (onFiltersChange && tableRef.current) {
      const currentFilters = tableRef.current.getState().columnFilters;
      onFiltersChange(currentFilters);
    }
  }, [onFiltersChange]);

  const pageSizeOptions = [10, 20, 50, 100];

  return (
    <div className="data-table-container">
      <LoadingCard loading={loading} />
      {!loading && (
        <>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <React.Fragment key={headerGroup.id}>
                    <tr className="data-table-header-row">
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          style={{ width: header.getSize(), position: 'relative' }}
                          className={header.column.getIsResizing() ? 'is-resizing' : ''}
                        >
                          <div
                            className={`data-table-header-content ${
                              header.column.getCanSort() ? 'sortable' : ''
                            }`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="data-table-sort-icon">
                                {header.column.getIsSorted() === 'asc' ? (
                                  <FaSortUp />
                                ) : header.column.getIsSorted() === 'desc' ? (
                                  <FaSortDown />
                                ) : (
                                  <FaSort />
                                )}
                              </span>
                            )}
                          </div>
                          {header.column.getCanResize() && (
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={`data-table-resizer ${
                                header.column.getIsResizing() ? 'isResizing' : ''
                              }`}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                    <tr className="data-table-filter-row">
                      {headerGroup.headers.map(header => (
                        <th
                          key={`filter-${header.id}`}
                          style={{ width: header.getSize(), position: 'relative' }}
                          className="data-table-filter-cell"
                        >
                          {header.column.getCanFilter() ? (
                            <Input
                              value={(header.column.getFilterValue() as string) ?? ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                header.column.setFilterValue(e.target.value)
                              }
                              onPressEnter={() => {
                                applyFilters();
                              }}
                              placeholder="Поиск..."
                              className="data-table-filter-input"
                              onClick={(e: React.MouseEvent<HTMLInputElement>) =>
                                e.stopPropagation()
                              }
                              allowClear
                            />
                          ) : null}
                        </th>
                      ))}
                    </tr>
                  </React.Fragment>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="data-table-empty-cell">
                      Нет данных
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map(cell => (
                        <td
                          key={cell.id}
                          style={{ width: cell.column.getSize() }}
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

          <div className="data-table-pagination">
            <div className="data-table-pagination-info">
              Показано {table.getRowModel().rows.length} из {totalRecords} записей
            </div>

            <div className="data-table-pagination-controls">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="data-table-pagination-icon"
                type="button"
              >
                <BiChevronsLeft size={20} />
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="data-table-pagination-icon"
                type="button"
              >
                <BiChevronLeft size={20} />
              </button>

              <span className="data-table-pagination-page-info">
                Страница {pagination.pageIndex + 1} из {totalPages}
              </span>

              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="data-table-pagination-icon"
                type="button"
              >
                <BiChevronRight size={20} />
              </button>
              <button
                onClick={() => table.setPageIndex(totalPages - 1)}
                disabled={!table.getCanNextPage()}
                className="data-table-pagination-icon"
                type="button"
              >
                <BiChevronsRight size={20} />
              </button>

              <Select
                value={pagination.pageSize}
                onChange={(value: unknown) => {
                  table.setPageSize(value as number);
                }}
                className="data-table-page-size-select"
                options={pageSizeOptions.map(pageSize => ({
                  label: `${pageSize} строк`,
                  value: pageSize,
                }))}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DataTable;
