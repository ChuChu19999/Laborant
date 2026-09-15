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
import { useEmployeesByHsnils } from '@/entities/Employee/@x/Sample';
import { hasActiveColumnFilters } from '@/shared/lib/table';
import { Button } from '@/shared/ui/Button';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { ResetFiltersButton } from '@/shared/ui/ResetFiltersButton';
import { TableEmptyState } from '@/shared/ui/TableEmptyState';
import { TablePagination } from '@/shared/ui/TablePagination';
import { TableSortIcon } from '@/shared/ui/TableSortIcon';
import { useSamplesTableFilterOptions } from '../../model/useSamplesTableFilterOptions';
import { createSamplesTableColumns } from './samplesTableColumns';
import { SamplesTableFilterRow } from './samplesTableFilterRow';
import type { Sample } from '../../api';
import './SamplesTable.css';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface SamplesTableProps {
  data: Sample[];
  loading?: boolean;
  pagination: PaginationState;
  totalPages: number;
  totalRecords: number;
  laboratoryId?: number;
  departmentId?: number;
  onPaginationChange: OnChangeFn<PaginationState>;
  onFiltersChange?: (filters: ColumnFiltersState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  sorting?: SortingState;
  onEdit: (sampleId: number) => void;
  onDelete: (sampleId: number) => void;
  onFillCalculations?: (sampleId: number) => void;
  onCreate?: () => void;
  onResetFilters?: () => void;
  initialColumnFilters?: ColumnFiltersState;
  canUpdate?: boolean;
  canDelete?: boolean;
  canFillCalculations?: boolean;
  canCreate?: boolean;
}

const SamplesTable = ({
  data,
  loading = false,
  pagination,
  totalPages,
  totalRecords,
  laboratoryId,
  departmentId,
  onPaginationChange,
  onFiltersChange,
  onSortingChange,
  sorting: externalSorting,
  onEdit,
  onDelete,
  onFillCalculations,
  onCreate,
  onResetFilters,
  initialColumnFilters,
  canUpdate = true,
  canDelete = true,
  canFillCalculations = true,
  canCreate = false,
}: SamplesTableProps) => {
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
  const tableRef = React.useRef<ReturnType<typeof useReactTable<Sample>> | null>(null);

  const uniqueAddedBy = React.useMemo(
    () =>
      Array.from(
        new Set(
          data
            .map(sample => sample.added_by)
            .filter((addedBy): addedBy is string => addedBy != null && addedBy !== '')
        )
      ).sort(),
    [data]
  );

  const { data: employeesMap = {} } = useEmployeesByHsnils(uniqueAddedBy, data.length > 0);
  const { sampleTypes, testObjects } = useSamplesTableFilterOptions(laboratoryId, departmentId);

  const columns = React.useMemo(
    () =>
      createSamplesTableColumns({
        canDelete,
        canFillCalculations,
        canUpdate,
        employeesMap,
        onDelete,
        onEdit,
        onFillCalculations,
      }),
    [onEdit, onDelete, onFillCalculations, canUpdate, canDelete, canFillCalculations, employeesMap]
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

  const table = useReactTable<Sample>({
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
    <div className="samples-table-container">
      <LoadingCard loading={loading} />
      {!loading && (
        <>
          <div className="samples-table-wrapper">
            <table className="samples-table">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <React.Fragment key={headerGroup.id}>
                    <tr className="samples-table-header-row">
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          {...{ width: header.getSize() }}
                          className={header.column.getIsResizing() ? 'is-resizing' : ''}
                        >
                          {header.column.getCanSort() ? (
                            <button
                              type="button"
                              className="samples-table-header-content sortable"
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <span className="samples-table-sort-icon">
                                <TableSortIcon sorted={header.column.getIsSorted()} />
                              </span>
                            </button>
                          ) : (
                            <div className="samples-table-header-content">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </div>
                          )}
                          {header.column.getCanResize() && (
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={`samples-table-resizer ${
                                header.column.getIsResizing() ? 'isResizing' : ''
                              }`}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                    <SamplesTableFilterRow
                      headers={headerGroup.headers}
                      applyFilters={applyFilters}
                      applyFiltersWithNewValue={applyFiltersWithNewValue}
                      sampleTypes={sampleTypes}
                      testObjects={testObjects}
                    />
                  </React.Fragment>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="samples-table-empty-cell">
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
                          title="Здесь будут поступления проб"
                          description="Добавьте первую пробу, чтобы начать расчёты."
                          action={
                            canCreate && onCreate ? (
                              <Button type="primary" onClick={onCreate}>
                                Добавить пробу
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

export default SamplesTable;
