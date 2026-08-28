import React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnFiltersState,
  type ColumnSizingState,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { hasActiveColumnFilters } from '@/shared/lib/table';
import { Button } from '@/shared/ui/Button';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { ResetFiltersButton } from '@/shared/ui/ResetFiltersButton';
import { TableEmptyState } from '@/shared/ui/TableEmptyState';
import { TablePagination } from '@/shared/ui/TablePagination';
import { TableSortIcon } from '@/shared/ui/TableSortIcon';
import { createProtocolsTableColumns } from './protocolsTableColumns';
import { ProtocolsTableFilterRow } from './protocolsTableFilterRow';
import './ProtocolsTable.css';
import type { Protocol } from '../../api';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface ProtocolsTableProps {
  data: Protocol[];
  loading?: boolean;
  pagination: PaginationState;
  totalPages: number;
  totalRecords: number;
  onPaginationChange: OnChangeFn<PaginationState>;
  onFiltersChange?: (filters: ColumnFiltersState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  sorting?: SortingState;
  onEdit: (protocolId: number) => void;
  onDelete: (protocolId: number) => void;
  onGenerateExcel?: (protocolId: number) => void | Promise<void>;
  onCreate?: () => void;
  onResetFilters?: () => void;
  initialColumnFilters?: ColumnFiltersState;
  canUpdate?: boolean;
  canDelete?: boolean;
  canCreate?: boolean;
}

const ProtocolsTable = ({
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
  onGenerateExcel,
  onCreate,
  onResetFilters,
  initialColumnFilters,
  canUpdate = true,
  canDelete = true,
  canCreate = false,
}: ProtocolsTableProps) => {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(externalSorting || []);
  const [generatingProtocols, setGeneratingProtocols] = React.useState<Set<number>>(new Set());

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
  const tableRef = React.useRef<ReturnType<typeof useReactTable<Protocol>> | null>(null);

  const handleGenerateExcelClick = React.useCallback(
    async (protocolId: number) => {
      if (!onGenerateExcel) {
        return;
      }

      setGeneratingProtocols(prev => {
        if (prev.has(protocolId)) {
          return prev;
        }
        return new Set(prev).add(protocolId);
      });

      try {
        const result = onGenerateExcel(protocolId);
        if (result instanceof Promise) {
          await result;
        }
      } finally {
        setGeneratingProtocols(prev => {
          const next = new Set(prev);
          next.delete(protocolId);
          return next;
        });
      }
    },
    [onGenerateExcel]
  );

  const columns = React.useMemo(
    () =>
      createProtocolsTableColumns({
        canDelete,
        canUpdate,
        generatingProtocols,
        onDelete,
        onEdit,
        onGenerateExcel,
        onGenerateExcelClick: (protocolId: number) => {
          void handleGenerateExcelClick(protocolId);
        },
      }),
    [
      onEdit,
      onDelete,
      onGenerateExcel,
      handleGenerateExcelClick,
      generatingProtocols,
      canUpdate,
      canDelete,
    ]
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

  const table = useReactTable<Protocol>({
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

  return (
    <div className="protocols-table-container">
      <LoadingCard loading={loading} />
      {!loading && (
        <>
          <div className="protocols-table-wrapper">
            <table className="protocols-table">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <React.Fragment key={headerGroup.id}>
                    <tr className="protocols-table-header-row">
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          {...{ width: header.getSize() }}
                          className={header.column.getIsResizing() ? 'is-resizing' : ''}
                        >
                          {header.column.getCanSort() ? (
                            <button
                              type="button"
                              className="protocols-table-header-content sortable"
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <span className="protocols-table-sort-icon">
                                <TableSortIcon sorted={header.column.getIsSorted()} />
                              </span>
                            </button>
                          ) : (
                            <div className="protocols-table-header-content">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </div>
                          )}
                          {header.column.getCanResize() && (
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={`protocols-table-resizer ${
                                header.column.getIsResizing() ? 'isResizing' : ''
                              }`}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                    <ProtocolsTableFilterRow
                      headers={headerGroup.headers}
                      applyFilters={applyFilters}
                    />
                  </React.Fragment>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="protocols-table-empty-cell">
                      {hasActiveColumnFilters(columnFilters) ? (
                        <TableEmptyState
                          title="Ничего не найдено"
                          description="Попробуйте изменить условия поиска или сбросить фильтры."
                          action={
                            onResetFilters ? <ResetFiltersButton onReset={onResetFilters} /> : null
                          }
                        />
                      ) : (
                        <TableEmptyState
                          title="Здесь будут протоколы"
                          description="Добавьте первый протокол."
                          action={
                            canCreate && onCreate ? (
                              <Button type="primary" onClick={onCreate}>
                                Добавить протокол
                              </Button>
                            ) : null
                          }
                        />
                      )}
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

export default ProtocolsTable;
