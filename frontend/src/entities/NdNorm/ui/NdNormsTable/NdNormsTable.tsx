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
import { createNdNormsTableColumns } from './ndNormsTableColumns';
import { NdNormsTableFilterRow } from './ndNormsTableFilterRow';
import type { NdNorm } from '../../api';
import type { ResearchMethodDisplayItem } from '@/entities/ResearchMethod/@x/NdNorm';
import './NdNormsTable.css';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface NdNormsTableProps {
  data: NdNorm[];
  methods: ResearchMethodDisplayItem[];
  laboratoryId?: number;
  departmentId?: number;
  loading?: boolean;
  pagination: PaginationState;
  totalPages: number;
  totalRecords: number;
  onPaginationChange: OnChangeFn<PaginationState>;
  onFiltersChange?: (filters: ColumnFiltersState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  sorting?: SortingState;
  onEdit: (ndNormId: number) => void;
  onDelete: (ndNormId: number) => void;
  initialColumnFilters?: ColumnFiltersState;
  canUpdate?: boolean;
  canDelete?: boolean;
}

const NdNormsTable = ({
  data,
  methods,
  laboratoryId,
  departmentId,
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
}: NdNormsTableProps) => {
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
  const tableRef = React.useRef<ReturnType<typeof useReactTable<NdNorm>> | null>(null);

  const columns = React.useMemo(
    () =>
      createNdNormsTableColumns({
        canDelete,
        canUpdate,
        methods,
        onDelete,
        onEdit,
      }),
    [methods, onEdit, onDelete, canUpdate, canDelete]
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

  const table = useReactTable<NdNorm>({
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
    (columnId: string, value: unknown) => {
      if (!tableRef.current) {
        return;
      }

      const currentFilters = tableRef.current.getState().columnFilters;
      const updatedFilters = currentFilters.filter(filter => filter.id !== columnId);

      if (
        value !== undefined &&
        value !== null &&
        value !== '' &&
        !(Array.isArray(value) && value.length === 0)
      ) {
        updatedFilters.push({ id: columnId, value });
      }

      tableRef.current.setColumnFilters(updatedFilters);
      if (onFiltersChange) {
        onFiltersChange(updatedFilters);
      }
    },
    [onFiltersChange]
  );

  return (
    <div className="nd-norms-table-container">
      <LoadingCard loading={loading} />
      {!loading && (
        <>
          <div className="nd-norms-table-wrapper">
            <table className="nd-norms-table">
              <colgroup>
                {table.getAllColumns().map(column => (
                  <col key={column.id} width={column.getSize()} />
                ))}
              </colgroup>
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <React.Fragment key={headerGroup.id}>
                    <tr className="nd-norms-table-header-row">
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          {...{ width: header.getSize() }}
                          className={header.column.getIsResizing() ? 'is-resizing' : ''}
                        >
                          {header.column.getCanSort() ? (
                            <button
                              type="button"
                              className="nd-norms-table-header-content sortable"
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <span className="nd-norms-table-sort-icon">
                                <TableSortIcon sorted={header.column.getIsSorted()} />
                              </span>
                            </button>
                          ) : (
                            <div className="nd-norms-table-header-content">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </div>
                          )}
                          {header.column.getCanResize() && (
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={`nd-norms-table-resizer ${
                                header.column.getIsResizing() ? 'isResizing' : ''
                              }`}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                    <NdNormsTableFilterRow
                      headers={headerGroup.headers}
                      applyFilters={applyFilters}
                      applyFiltersWithNewValue={applyFiltersWithNewValue}
                      laboratoryId={laboratoryId}
                      departmentId={departmentId}
                    />
                  </React.Fragment>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="nd-norms-table-empty-cell">
                      Нормы НД не найдены
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

export default NdNormsTable;
