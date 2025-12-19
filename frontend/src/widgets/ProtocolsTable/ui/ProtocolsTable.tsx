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
import { LoadingCard } from '../../../features/Cards';
import { type Protocol } from '../../../shared/api/protocols';
import { getDateRangePresets } from '../../../shared/lib/datePresets';
import { urlParamsToFilters } from '../../../shared/lib/urlParams';
import Button from '../../../shared/ui/Button/Button';
import { Input, Select, RangePicker } from '../../../shared/ui/FormItems';
import './ProtocolsTable.css';

dayjs.extend(customParseFormat);

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
  onGenerateExcel?: (protocolId: number) => void;
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  return dayjs(dateString).format('DD.MM.YYYY');
};

const formatProtocolNumber = (
  number?: string,
  date?: string,
  isAccredited?: boolean,
  samples?: Array<{ test_object?: string }>
): string => {
  if (!number && !date) return '-';
  if (!isAccredited) return number || '-';

  const getObjectSuffix = (): string => {
    if (!samples || !samples.length) return '';
    const firstSample = samples.find(sample => sample.test_object);
    if (!firstSample || !firstSample.test_object) return '';

    const testObjectLower = firstSample.test_object.toLowerCase();
    if (testObjectLower.includes('дегазированный конденсат')) return 'дк';
    if (testObjectLower.includes('нефть') || testObjectLower.includes('нефть калибровочная'))
      return 'н';
    if (testObjectLower.includes('нефтеконденсатная смесь')) return 'нкс';
    if (testObjectLower.includes('дизельное топливо')) return 'дт';
    if (testObjectLower.includes('отработанные нефтепродукты')) return 'он';
    if (testObjectLower.includes('масло турбинное')) return 'м';
    if (testObjectLower.includes('масло авиационное')) return 'м';
    if (testObjectLower.includes('смесь жидких углеводородов')) return 'с';
    if (testObjectLower.includes('ингибитор коррозии')) return 'ик';
    return '';
  };

  const suffix = getObjectSuffix();
  const formattedDate = formatDate(date);

  if (!number) return `от ${formattedDate}`;
  if (!date) return number;

  const protocolNumber = suffix ? `${number}/07/${suffix}` : `${number}/07`;
  return `${protocolNumber} от ${formattedDate}`;
};

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
}) => {
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

  const columns = React.useMemo<ColumnDef<Protocol>[]>(
    () => [
      {
        accessorKey: 'test_protocol_number',
        header: '№ протокола',
        cell: ({ row }) =>
          formatProtocolNumber(
            row.original.test_protocol_number,
            row.original.test_protocol_date,
            row.original.is_accredited,
            row.original.samples_data
          ),
        enableSorting: true,
        enableColumnFilter: true,
        size: 200,
      },
      {
        accessorKey: 'sampling_act_number',
        header: 'Номер акта отбора',
        cell: ({ row }) => row.original.sampling_act_number || '-',
        enableSorting: true,
        enableColumnFilter: true,
        size: 160,
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
        size: 200,
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
        size: 120,
      },
      {
        accessorKey: 'created_at',
        header: 'Дата создания',
        cell: ({ row }) => formatDate(row.original.created_at),
        enableSorting: true,
        enableColumnFilter: true,
        size: 180,
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
            {onGenerateExcel && row.original.protocol_template_id && (
              <Button
                type="text"
                size="small"
                icon={<FileExcelOutlined />}
                onClick={() => onGenerateExcel(row.original.id)}
                className="protocols-table-edit-button"
              >
                Сформировать
              </Button>
            )}
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(row.original.id)}
              className="protocols-table-edit-button"
            >
              Редактировать
            </Button>
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
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        size: 200,
        enableResizing: false,
      },
    ],
    [onEdit, onDelete, onGenerateExcel]
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
                      Протоколы не найдены
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
