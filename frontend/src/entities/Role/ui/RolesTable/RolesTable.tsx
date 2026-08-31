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
import { Input, Select } from '@/shared/ui/FormItems';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { TableFilterCell, TableFilterTheme, tableFilterSelectProps } from '@/shared/ui/TableFilter';
import { TablePagination } from '@/shared/ui/TablePagination';
import { TableSortIcon } from '@/shared/ui/TableSortIcon';
import { ROLE_TYPE_OPTIONS } from '../../lib/roleTypeOptions';
import { createRolesTableColumns } from './rolesTableColumns';
import type { RoleCatalogItem } from '../../api';
import './RolesTable.css';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface RolesTableProps {
  data: RoleCatalogItem[];
  loading?: boolean;
  pagination: PaginationState;
  totalPages: number;
  totalRecords: number;
  onPaginationChange: OnChangeFn<PaginationState>;
  onFiltersChange?: (filters: ColumnFiltersState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  sorting?: SortingState;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onConfigure: (id: number) => void;
  initialColumnFilters?: ColumnFiltersState;
}

const RolesTable = ({
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
  onConfigure,
  initialColumnFilters,
}: RolesTableProps) => {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    () => initialColumnFilters ?? []
  );
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(externalSorting || []);
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const tableRef = React.useRef<ReturnType<typeof useReactTable<RoleCatalogItem>> | null>(null);

  React.useEffect(() => {
    if (externalSorting !== undefined) {
      setInternalSorting(externalSorting);
    }
  }, [externalSorting]);

  const handleSortingChange = React.useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const newSorting = typeof updater === 'function' ? updater(internalSorting) : updater;
      setInternalSorting(newSorting);
      onSortingChange?.(newSorting);
    },
    [internalSorting, onSortingChange]
  );

  const columns = React.useMemo(
    () => createRolesTableColumns({ onEdit, onDelete, onConfigure }),
    [onEdit, onDelete, onConfigure]
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

  const table = useReactTable<RoleCatalogItem>({
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
      onFiltersChange(tableRef.current.getState().columnFilters);
    }
  }, [onFiltersChange]);

  return (
    <div className="roles-table-container">
      <LoadingCard loading={loading} />
      {!loading && (
        <>
          <div className="roles-table-wrapper">
            <table className="roles-table">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <React.Fragment key={headerGroup.id}>
                    <tr className="roles-table-header-row">
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          {...{ width: header.getSize() }}
                          className={header.column.getIsResizing() ? 'is-resizing' : ''}
                        >
                          {header.column.getCanSort() ? (
                            <button
                              type="button"
                              className="roles-table-header-content sortable"
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <span className="roles-table-sort-icon">
                                <TableSortIcon sorted={header.column.getIsSorted()} />
                              </span>
                            </button>
                          ) : (
                            <div className="roles-table-header-content">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </div>
                          )}
                          {header.column.getCanResize() && (
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={`roles-table-resizer ${
                                header.column.getIsResizing() ? 'isResizing' : ''
                              }`}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                    <TableFilterTheme>
                      <tr className="roles-table-filter-row">
                        {headerGroup.headers.map((header, columnIndex) => (
                          <TableFilterCell
                            key={`filter-${header.id}`}
                            columnIndex={columnIndex}
                            columnCount={headerGroup.headers.length}
                            className="roles-table-filter-cell"
                          >
                            {selectPopup =>
                              header.column.getCanFilter() ? (
                                header.id === 'role_type' ? (
                                  <Select
                                    value={header.column.getFilterValue() || undefined}
                                    onChange={(value: unknown) => {
                                      header.column.setFilterValue(value || undefined);
                                      setTimeout(() => applyFilters(), 0);
                                    }}
                                    {...tableFilterSelectProps(selectPopup)}
                                    placeholder="Все типы"
                                    className="table-filter-select"
                                    options={ROLE_TYPE_OPTIONS}
                                    onClick={(event: React.MouseEvent<HTMLElement>) =>
                                      event.stopPropagation()
                                    }
                                  />
                                ) : (
                                  <Input
                                    value={(header.column.getFilterValue() as string) ?? ''}
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                                      header.column.setFilterValue(event.target.value)
                                    }
                                    onPressEnter={() => {
                                      applyFilters();
                                    }}
                                    placeholder="Поиск..."
                                    className="table-filter-input"
                                    onClick={(event: React.MouseEvent<HTMLInputElement>) =>
                                      event.stopPropagation()
                                    }
                                    allowClear
                                  />
                                )
                              ) : null
                            }
                          </TableFilterCell>
                        ))}
                      </tr>
                    </TableFilterTheme>
                  </React.Fragment>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="roles-table-empty-cell">
                      Области видимости ролей не найдены
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

export default RolesTable;
