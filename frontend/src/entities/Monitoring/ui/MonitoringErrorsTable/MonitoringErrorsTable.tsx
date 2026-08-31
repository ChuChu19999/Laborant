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
import { createMonitoringErrorsTableColumns } from './monitoringErrorsTableColumns';
import type { MonitoringErrorItem, MonitoringOption } from '../../api';
import './MonitoringErrorsTable.css';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const FILTER_PLACEHOLDERS: Record<string, string> = {
  summary: 'Поиск...',
  occurrence_count: 'Число',
  app_version: 'Версия',
  last_seen_at: 'ДД.ММ...',
};

interface MonitoringErrorsTableProps {
  data: MonitoringErrorItem[];
  loading?: boolean;
  pagination: PaginationState;
  totalPages: number;
  totalRecords: number;
  onPaginationChange: OnChangeFn<PaginationState>;
  onFiltersChange?: (filters: ColumnFiltersState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  sorting?: SortingState;
  onDetails: (item: MonitoringErrorItem) => void;
  onStatusChange: (errorId: number, resolved: boolean, comment?: string | null) => void;
  statusPendingErrorId?: number | null;
  initialColumnFilters?: ColumnFiltersState;
  embedded?: boolean;
  severityFilterOptions?: MonitoringOption[];
  sourceFilterOptions?: MonitoringOption[];
  resolvedFilterOptions?: MonitoringOption[];
}

const MonitoringErrorsTable = ({
  data,
  loading = false,
  pagination,
  totalPages,
  totalRecords,
  onPaginationChange,
  onFiltersChange,
  onSortingChange,
  sorting: externalSorting,
  onDetails,
  onStatusChange,
  statusPendingErrorId,
  initialColumnFilters,
  embedded = false,
  severityFilterOptions = [],
  sourceFilterOptions = [],
  resolvedFilterOptions = [],
}: MonitoringErrorsTableProps) => {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    () => initialColumnFilters ?? []
  );
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(externalSorting || []);
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const tableRef = React.useRef<ReturnType<typeof useReactTable<MonitoringErrorItem>> | null>(null);

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
    () =>
      createMonitoringErrorsTableColumns({
        onDetails,
        onStatusChange,
        statusPendingErrorId,
        severityOptions: severityFilterOptions,
        sourceOptions: sourceFilterOptions,
      }),
    [onDetails, onStatusChange, statusPendingErrorId, severityFilterOptions, sourceFilterOptions]
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

  const table = useReactTable<MonitoringErrorItem>({
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
    enableColumnResizing: !embedded,
    columnResizeMode: 'onChange',
  });

  tableRef.current = table;

  const applyFilters = React.useCallback(() => {
    if (onFiltersChange && tableRef.current) {
      onFiltersChange(tableRef.current.getState().columnFilters);
    }
  }, [onFiltersChange]);

  return (
    <div
      className={[
        'monitoring-errors-table-container',
        embedded ? 'monitoring-errors-table-container--embedded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <LoadingCard loading={loading} />
      {!loading && (
        <>
          <div className="monitoring-errors-table-wrapper">
            <table className="monitoring-errors-table">
              {embedded && (
                <colgroup>
                  <col className="monitoring-errors-col monitoring-errors-col--severity" />
                  <col className="monitoring-errors-col monitoring-errors-col--source" />
                  <col className="monitoring-errors-col monitoring-errors-col--summary" />
                  <col className="monitoring-errors-col monitoring-errors-col--repeats" />
                  <col className="monitoring-errors-col monitoring-errors-col--version" />
                  <col className="monitoring-errors-col monitoring-errors-col--last" />
                  <col className="monitoring-errors-col monitoring-errors-col--status" />
                  <col className="monitoring-errors-col monitoring-errors-col--actions" />
                </colgroup>
              )}
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <React.Fragment key={headerGroup.id}>
                    <tr className="monitoring-errors-table-header-row">
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          {...(embedded ? {} : { width: header.getSize() })}
                          className={header.column.getIsResizing() ? 'is-resizing' : ''}
                        >
                          {header.column.getCanSort() ? (
                            <button
                              type="button"
                              className="monitoring-errors-table-header-content sortable"
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              <span className="monitoring-errors-table-header-label">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </span>
                              <span className="monitoring-errors-table-sort-icon">
                                <TableSortIcon sorted={header.column.getIsSorted()} />
                              </span>
                            </button>
                          ) : (
                            <div className="monitoring-errors-table-header-content">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </div>
                          )}
                          {header.column.getCanResize() && !embedded && (
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={`monitoring-errors-table-resizer ${
                                header.column.getIsResizing() ? 'isResizing' : ''
                              }`}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                    <TableFilterTheme>
                      <tr className="monitoring-errors-table-filter-row">
                        {headerGroup.headers.map((header, columnIndex) => (
                          <TableFilterCell
                            key={`filter-${header.id}`}
                            columnIndex={columnIndex}
                            columnCount={headerGroup.headers.length}
                            className="monitoring-errors-table-filter-cell"
                          >
                            {selectPopup =>
                              header.column.getCanFilter() ? (
                                header.id === 'severity' ? (
                                  <Select
                                    value={header.column.getFilterValue() || undefined}
                                    onChange={(value: unknown) => {
                                      header.column.setFilterValue(value || undefined);
                                      setTimeout(() => applyFilters(), 0);
                                    }}
                                    {...tableFilterSelectProps(selectPopup)}
                                    placeholder="Уровень"
                                    className="table-filter-select"
                                    options={severityFilterOptions}
                                    onClick={(event: React.MouseEvent<HTMLElement>) =>
                                      event.stopPropagation()
                                    }
                                  />
                                ) : header.id === 'source' ? (
                                  <Select
                                    value={header.column.getFilterValue() || undefined}
                                    onChange={(value: unknown) => {
                                      header.column.setFilterValue(value || undefined);
                                      setTimeout(() => applyFilters(), 0);
                                    }}
                                    {...tableFilterSelectProps(selectPopup)}
                                    placeholder="Источник"
                                    className="table-filter-select"
                                    options={sourceFilterOptions}
                                    onClick={(event: React.MouseEvent<HTMLElement>) =>
                                      event.stopPropagation()
                                    }
                                  />
                                ) : header.id === 'resolved' ? (
                                  <Select
                                    value={header.column.getFilterValue() || undefined}
                                    onChange={(value: unknown) => {
                                      header.column.setFilterValue(value || undefined);
                                      setTimeout(() => applyFilters(), 0);
                                    }}
                                    {...tableFilterSelectProps(selectPopup)}
                                    placeholder="Статус"
                                    className="table-filter-select"
                                    options={resolvedFilterOptions}
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
                                    placeholder={FILTER_PLACEHOLDERS[header.id] ?? 'Поиск...'}
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
                    <td colSpan={columns.length} className="monitoring-errors-table-empty-cell">
                      Ошибки не найдены.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map(cell => (
                        <td
                          key={cell.id}
                          {...(embedded ? {} : { width: cell.column.getSize() })}
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

export default MonitoringErrorsTable;
