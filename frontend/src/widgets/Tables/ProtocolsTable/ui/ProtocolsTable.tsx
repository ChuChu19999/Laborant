import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { DeleteOutlined, EditOutlined, FileExcelOutlined } from '@ant-design/icons';
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
import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { BiChevronLeft, BiChevronRight, BiChevronsLeft, BiChevronsRight } from 'react-icons/bi';
import { FaSortUp, FaSortDown, FaSort } from 'react-icons/fa';
import { ResetFiltersButton } from '../../../../entities/ResetFiltersButton';
import { LoadingCard } from '../../../../features/Cards';
import { type Protocol } from '../../../../shared/api/protocols';
import { getDateRangePresets } from '../../../../shared/lib/datePresets';
import { urlParamsToFilters } from '../../../../shared/lib/urlParams';
import Button from '../../../../shared/ui/Button';
import { Input, Select, RangePicker } from '../../../../shared/ui/FormItems';
import { TableEmptyState } from '../../../../shared/ui/TableEmptyState';
import { formatDate } from '../../../../shared/utils/dateFormatting';
import './ProtocolsTable.css';

dayjs.extend(customParseFormat);

function hasActiveColumnFilters(filters: ColumnFiltersState): boolean {
  return filters.some(filter => {
    const value = filter.value;
    if (value == null || value === '') {
      return false;
    }
    if (Array.isArray(value)) {
      return value.some(item => item != null && item !== '');
    }
    return true;
  });
}

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
  canUpdate?: boolean;
  canDelete?: boolean;
  canCreate?: boolean;
}

const ProtocolsTable: React.FC<ProtocolsTableProps> = ({
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
  canUpdate = true,
  canDelete = true,
  canCreate = false,
}) => {
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

  const [searchParams] = useSearchParams();
  const filterKeys = React.useMemo(
    () => [
      'test_protocol_number',
      'sampling_act_number',
      'is_accredited',
      'search_samples',
      'test_protocol_date_from',
      'test_protocol_date_to',
      'created_at_from',
      'created_at_to',
    ],
    []
  );

  const urlFiltersToColumnFilters = React.useCallback((): ColumnFiltersState => {
    const urlFilters = urlParamsToFilters(searchParams, filterKeys);
    const columnFilters: ColumnFiltersState = [];

    if (urlFilters.test_protocol_number && typeof urlFilters.test_protocol_number === 'string') {
      columnFilters.push({ id: 'test_protocol_number', value: urlFilters.test_protocol_number });
    }
    if (urlFilters.sampling_act_number && typeof urlFilters.sampling_act_number === 'string') {
      columnFilters.push({ id: 'sampling_act_number', value: urlFilters.sampling_act_number });
    }
    if (urlFilters.search_samples && typeof urlFilters.search_samples === 'string') {
      columnFilters.push({ id: 'samples_data', value: urlFilters.search_samples });
    }
    if (urlFilters.is_accredited !== undefined && urlFilters.is_accredited !== null) {
      const isAccreditedValue =
        (typeof urlFilters.is_accredited === 'string' &&
          (urlFilters.is_accredited === 'true' || urlFilters.is_accredited === '1')) ||
        (Array.isArray(urlFilters.is_accredited) &&
          urlFilters.is_accredited.length > 0 &&
          (urlFilters.is_accredited[0] === 'true' || urlFilters.is_accredited[0] === '1'));
      columnFilters.push({ id: 'is_accredited', value: isAccreditedValue });
    }

    const testProtocolFrom = urlFilters.test_protocol_date_from;
    const testProtocolTo = urlFilters.test_protocol_date_to;
    if (testProtocolFrom || testProtocolTo) {
      const startDate =
        testProtocolFrom && typeof testProtocolFrom === 'string' ? dayjs(testProtocolFrom) : null;
      const endDate =
        testProtocolTo && typeof testProtocolTo === 'string' ? dayjs(testProtocolTo) : null;
      if (startDate || endDate) {
        columnFilters.push({ id: 'test_protocol_date', value: [startDate, endDate] });
      }
    }

    const createdFrom = urlFilters.created_at_from;
    const createdTo = urlFilters.created_at_to;
    if (createdFrom || createdTo) {
      const startDate = createdFrom && typeof createdFrom === 'string' ? dayjs(createdFrom) : null;
      const endDate = createdTo && typeof createdTo === 'string' ? dayjs(createdTo) : null;
      if (startDate || endDate) {
        columnFilters.push({ id: 'created_at', value: [startDate, endDate] });
      }
    }

    return columnFilters;
  }, [searchParams, filterKeys]);

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(() =>
    urlFiltersToColumnFilters()
  );

  const searchParamsStr = searchParams.toString();
  React.useEffect(() => {
    const newFilters = urlFiltersToColumnFilters();
    setColumnFilters(newFilters);
  }, [searchParamsStr, urlFiltersToColumnFilters]);

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

  const columns = React.useMemo<ColumnDef<Protocol>[]>(
    () => [
      {
        accessorKey: 'test_protocol_number',
        header: '№ протокола',
        cell: ({ row }) => row.original.formatted_protocol_number || '-',
        enableSorting: true,
        enableColumnFilter: true,
        size: 300,
      },
      {
        accessorKey: 'sampling_act_number',
        header: 'Номер акта отбора',
        cell: ({ row }) => row.original.sampling_act_number || '-',
        enableSorting: true,
        enableColumnFilter: true,
        size: 250,
      },
      {
        id: 'samples_data',
        header: 'Пробы',
        accessorFn: row => {
          if (
            !row.samples_data ||
            !Array.isArray(row.samples_data) ||
            row.samples_data.length === 0
          )
            return '';
          return row.samples_data.map(sample => sample.registration_number).join(', ');
        },
        cell: ({ row }) => {
          if (
            !row.original.samples_data ||
            !Array.isArray(row.original.samples_data) ||
            row.original.samples_data.length === 0
          )
            return '-';
          return row.original.samples_data.map(sample => sample.registration_number).join(', ');
        },
        enableSorting: true,
        enableColumnFilter: true,
        size: 250,
      },
      {
        accessorKey: 'is_accredited',
        header: 'Аккредитован',
        cell: ({ row }) => (
          <span
            className={
              row.original.is_accredited
                ? 'protocols-table-accredited-check'
                : 'protocols-table-accredited-cross'
            }
          >
            {row.original.is_accredited ? '✓' : '✗'}
          </span>
        ),
        enableSorting: true,
        enableColumnFilter: true,
        size: 220,
      },
      {
        accessorKey: 'created_at',
        header: 'Дата создания',
        cell: ({ row }) => formatDate(row.original.created_at),
        enableSorting: true,
        enableColumnFilter: true,
        size: 250,
        filterFn: (row, _id, filterValue) => {
          if (!filterValue) return true;
          if (!row.original.created_at) return false;

          const rowDate = dayjs(row.original.created_at);

          if (Array.isArray(filterValue) && filterValue.length === 2) {
            const [startDate, endDate] = filterValue as [Dayjs | null, Dayjs | null];
            if (!startDate || !endDate) return true;

            const start = startDate.startOf('day');
            const end = endDate.endOf('day');
            return (
              (rowDate.isSame(start, 'day') || rowDate.isAfter(start)) &&
              (rowDate.isSame(end, 'day') || rowDate.isBefore(end))
            );
          }

          return true;
        },
      },
      {
        id: 'actions',
        header: 'Действия',
        cell: ({ row }) => (
          <div className="protocols-table-actions">
            {onGenerateExcel &&
              row.original.protocol_template_id &&
              row.original.has_undeleted_calculations && (
                <Button
                  type="text"
                  size="small"
                  icon={<FileExcelOutlined />}
                  onClick={() => handleGenerateExcelClick(row.original.id)}
                  loading={generatingProtocols.has(row.original.id)}
                  className="protocols-table-edit-button"
                >
                  Сформировать
                </Button>
              )}
            {canUpdate && (
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEdit(row.original.id)}
                className="protocols-table-edit-button"
              >
                Редактировать
              </Button>
            )}
            {canDelete && (
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => onDelete(row.original.id)}
                className="protocols-table-delete-button"
              >
                Удалить
              </Button>
            )}
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        size: 80,
        enableResizing: false,
      },
    ],
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

  const pageSizeOptions = React.useMemo(() => [10, 20, 50, 100], []);

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
                          style={{ width: header.getSize(), position: 'relative' }}
                          className={header.column.getIsResizing() ? 'is-resizing' : ''}
                        >
                          <div
                            className={`protocols-table-header-content ${
                              header.column.getCanSort() ? 'sortable' : ''
                            }`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="protocols-table-sort-icon">
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
                              className={`protocols-table-resizer ${
                                header.column.getIsResizing() ? 'isResizing' : ''
                              }`}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                    <tr className="protocols-table-filter-row">
                      {headerGroup.headers.map(header => (
                        <th key={`filter-${header.id}`} className="protocols-table-filter-cell">
                          {header.column.getCanFilter() &&
                          (header.column.id === 'test_protocol_date' ||
                            header.column.id === 'created_at') ? (
                            <RangePicker
                              value={(() => {
                                const filterValue = header.column.getFilterValue();
                                if (
                                  filterValue &&
                                  Array.isArray(filterValue) &&
                                  filterValue.length === 2 &&
                                  filterValue[0] &&
                                  filterValue[1]
                                ) {
                                  return [
                                    dayjs(filterValue[0] as Dayjs),
                                    dayjs(filterValue[1] as Dayjs),
                                  ];
                                }
                                return null;
                              })()}
                              onChange={(dates: unknown) => {
                                const dateRange = dates as [Dayjs | null, Dayjs | null] | null;
                                header.column.setFilterValue(dateRange);
                                setTimeout(() => {
                                  applyFilters();
                                }, 0);
                              }}
                              placeholder={['С', 'По']}
                              className="protocols-table-filter-datepicker"
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              allowClear
                              presets={getDateRangePresets()}
                            />
                          ) : header.column.getCanFilter() &&
                            header.column.id === 'is_accredited' ? (
                            <Select
                              value={
                                (header.column.getFilterValue() as boolean | undefined) ?? undefined
                              }
                              onChange={(value: unknown) => {
                                header.column.setFilterValue(
                                  value === undefined || value === null ? null : value
                                );
                                setTimeout(() => {
                                  applyFilters();
                                }, 0);
                              }}
                              placeholder="Выберите"
                              className="protocols-table-filter-select"
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              allowClear
                              options={[
                                { label: 'Да', value: true },
                                { label: 'Нет', value: false },
                              ]}
                            />
                          ) : header.column.getCanFilter() ? (
                            <Input
                              value={(header.column.getFilterValue() as string) ?? ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                header.column.setFilterValue(e.target.value)
                              }
                              onPressEnter={() => {
                                applyFilters();
                              }}
                              placeholder="Поиск..."
                              className="protocols-table-filter-input"
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
                          description="Протоколы появятся после оформления. Для этого нужны пробы с расчётами."
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

          <div className="protocols-table-pagination">
            <div className="protocols-table-pagination-info">
              Показано {table.getRowModel().rows.length} из {totalRecords} записей
            </div>

            <div className="protocols-table-pagination-controls">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="protocols-table-pagination-icon"
                type="button"
              >
                <BiChevronsLeft size={20} />
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="protocols-table-pagination-icon"
                type="button"
              >
                <BiChevronLeft size={20} />
              </button>

              <span className="protocols-table-pagination-page-info">
                Страница {pagination.pageIndex + 1} из {totalPages}
              </span>

              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="protocols-table-pagination-icon"
                type="button"
              >
                <BiChevronRight size={20} />
              </button>
              <button
                onClick={() => table.setPageIndex(totalPages - 1)}
                disabled={!table.getCanNextPage()}
                className="protocols-table-pagination-icon"
                type="button"
              >
                <BiChevronsRight size={20} />
              </button>

              <Select
                value={pagination.pageSize}
                onChange={(value: unknown) => {
                  table.setPageSize(value as number);
                }}
                className="protocols-table-page-size-select"
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
};

export default ProtocolsTable;
