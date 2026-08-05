import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
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
import { Checkbox } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { BiChevronLeft, BiChevronRight, BiChevronsLeft, BiChevronsRight } from 'react-icons/bi';
import { FaSortUp, FaSortDown, FaSort } from 'react-icons/fa';
import { LoadingCard } from '../../../../features/Cards';
import { type NdNorm } from '../../../../shared/api/ndNorms';
import { samplesApi } from '../../../../shared/api/samples';
import { getDateRangePresets } from '../../../../shared/lib/datePresets';
import { urlFilterValueToStringArray, urlParamsToFilters } from '../../../../shared/lib/urlParams';
import { type ResearchMethodDisplayItem } from '../../../../shared/model/hooks/useResearchMethodsForLab';
import { useAutoRefetchQuery } from '../../../../shared/model/lib/useQuery';
import Button from '../../../../shared/ui/Button';
import { Input, RangePicker, Select } from '../../../../shared/ui/FormItems';
import { formatDate } from '../../../../shared/utils/dateFormatting';
import './NdNormsTable.css';

dayjs.extend(customParseFormat);

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
  canUpdate?: boolean;
  canDelete?: boolean;
}

const getMethodValue = (ndNorm: NdNorm, methodId: number): string => {
  const item = ndNorm.method_data?.find(entry => entry.method_id === methodId);
  const value = item?.value?.trim();
  return value || '-';
};

const NdNormsTable: React.FC<NdNormsTableProps> = ({
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
  canUpdate = true,
  canDelete = true,
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
    () => ['name', 'test_object', 'test_objects', 'created_at_from', 'created_at_to'],
    []
  );

  const urlFiltersToColumnFilters = React.useCallback((): ColumnFiltersState => {
    const urlFilters = urlParamsToFilters(searchParams, filterKeys);
    const columnFilters: ColumnFiltersState = [];

    if (urlFilters.name && typeof urlFilters.name === 'string') {
      columnFilters.push({ id: 'name', value: urlFilters.name });
    }

    const testObjectArray = urlFilterValueToStringArray(
      urlFilters.test_objects,
      urlFilters.test_object
    );
    if (testObjectArray.length > 0) {
      columnFilters.push({ id: 'test_object', value: testObjectArray });
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

  const initialTestObjectFilter = React.useMemo(() => {
    const filters = urlFiltersToColumnFilters();
    const testObjectFilter = filters.find(filter => filter.id === 'test_object');
    return testObjectFilter && Array.isArray(testObjectFilter.value)
      ? (testObjectFilter.value as string[])
      : [];
  }, [urlFiltersToColumnFilters]);

  const [tempTestObjectFilter, setTempTestObjectFilter] =
    React.useState<string[]>(initialTestObjectFilter);
  const tempTestObjectFilterRef = React.useRef<string[]>(initialTestObjectFilter);

  const previousFiltersRef = React.useRef<string>('');
  const searchParamsStr = searchParams.toString();
  React.useEffect(() => {
    const newFilters = urlFiltersToColumnFilters();
    const newStr = JSON.stringify(newFilters);
    if (previousFiltersRef.current !== newStr) {
      previousFiltersRef.current = newStr;
      setColumnFilters(newFilters);
      const testObjectFilter = newFilters.find(filter => filter.id === 'test_object');
      const testObjectValues =
        testObjectFilter && Array.isArray(testObjectFilter.value)
          ? (testObjectFilter.value as string[])
          : [];
      setTempTestObjectFilter(testObjectValues);
      tempTestObjectFilterRef.current = testObjectValues;
    }
  }, [searchParamsStr, urlFiltersToColumnFilters]);

  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const tableRef = React.useRef<ReturnType<typeof useReactTable<NdNorm>> | null>(null);

  const columns = React.useMemo<ColumnDef<NdNorm>[]>(() => {
    const methodColumns: ColumnDef<NdNorm>[] = methods.map(method => ({
      id: `method_${method.id}`,
      header: method.displayName,
      cell: ({ row }) => (
        <span className="nd-norms-table-method-cell">
          {getMethodValue(row.original, method.id)}
        </span>
      ),
      enableSorting: false,
      enableColumnFilter: false,
      size: 220,
    }));

    return [
      {
        accessorKey: 'name',
        header: 'Наименование нормы',
        cell: ({ row }) => (
          <span className="nd-norms-table-name-cell">{row.original.name || '-'}</span>
        ),
        enableSorting: true,
        enableColumnFilter: true,
        size: 280,
      },
      {
        accessorKey: 'test_object',
        header: 'Объект испытания',
        cell: ({ row }) => row.original.test_object || '-',
        enableSorting: true,
        enableColumnFilter: true,
        size: 200,
      },
      ...methodColumns,
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
          <div className="nd-norms-table-actions">
            {canUpdate && (
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEdit(row.original.id)}
                className="nd-norms-table-edit-button"
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
                className="nd-norms-table-delete-button"
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
    ];
  }, [methods, onEdit, onDelete, canUpdate, canDelete]);

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

  const pageSizeOptions = React.useMemo(() => [10, 20, 50, 100], []);
  const tableMinWidth = table.getTotalSize();

  const { data: testObjects = [] } = useAutoRefetchQuery<string[]>(
    ['test-objects', laboratoryId, departmentId],
    () => samplesApi.getTestObjects(laboratoryId, departmentId),
    {
      enabled: !!laboratoryId,
    }
  );

  return (
    <div className="nd-norms-table-container">
      <LoadingCard loading={loading} />
      {!loading && (
        <>
          <div className="nd-norms-table-wrapper">
            <table className="nd-norms-table" style={{ minWidth: tableMinWidth }}>
              <colgroup>
                {table.getAllColumns().map(column => (
                  <col key={column.id} style={{ width: column.getSize() }} />
                ))}
              </colgroup>
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <React.Fragment key={headerGroup.id}>
                    <tr className="nd-norms-table-header-row">
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          style={{ width: header.getSize(), position: 'relative' }}
                          className={header.column.getIsResizing() ? 'is-resizing' : ''}
                        >
                          <div
                            className={`nd-norms-table-header-content ${
                              header.column.getCanSort() ? 'sortable' : ''
                            }`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="nd-norms-table-sort-icon">
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
                              className={`nd-norms-table-resizer ${
                                header.column.getIsResizing() ? 'isResizing' : ''
                              }`}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                    <tr className="nd-norms-table-filter-row">
                      {headerGroup.headers.map(header => (
                        <th key={`filter-${header.id}`} className="nd-norms-table-filter-cell">
                          {header.column.getCanFilter() && header.column.id === 'created_at' ? (
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
                              className="nd-norms-table-filter-datepicker"
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              allowClear
                              presets={getDateRangePresets()}
                            />
                          ) : header.column.getCanFilter() && header.column.id === 'test_object' ? (
                            <Select
                              mode="multiple"
                              value={tempTestObjectFilter}
                              onChange={(value: unknown) => {
                                const newValue = value as string[];
                                setTempTestObjectFilter(newValue);
                                tempTestObjectFilterRef.current = newValue;
                              }}
                              onDeselect={(value: unknown) => {
                                const newValue = tempTestObjectFilter.filter(
                                  item => item !== value
                                );
                                setTempTestObjectFilter(newValue);
                                tempTestObjectFilterRef.current = newValue;
                                applyFiltersWithNewValue(header.column.id, newValue);
                              }}
                              onDropdownVisibleChange={(open: boolean) => {
                                if (!open) {
                                  applyFiltersWithNewValue(
                                    header.column.id,
                                    tempTestObjectFilterRef.current
                                  );
                                }
                              }}
                              placeholder="Выберите объекты"
                              className="nd-norms-table-filter-select"
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              allowClear
                              showSearch
                              filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                              }
                              onClear={() => {
                                setTempTestObjectFilter([]);
                                tempTestObjectFilterRef.current = [];
                                applyFiltersWithNewValue(header.column.id, []);
                              }}
                              options={testObjects.map(obj => ({
                                label: obj,
                                value: obj,
                              }))}
                              optionRender={option => {
                                const isSelected = tempTestObjectFilter.includes(
                                  option.value as string
                                );
                                return (
                                  <div className="nd-norms-table-filter-select-option">
                                    <Checkbox
                                      checked={isSelected}
                                      onClick={event => {
                                        event.stopPropagation();
                                        const newValue = isSelected
                                          ? tempTestObjectFilter.filter(
                                              item => item !== option.value
                                            )
                                          : [...tempTestObjectFilter, option.value as string];
                                        setTempTestObjectFilter(newValue);
                                        tempTestObjectFilterRef.current = newValue;
                                      }}
                                    />
                                    <span>{option.label}</span>
                                  </div>
                                );
                              }}
                            />
                          ) : header.column.getCanFilter() && header.column.id === 'name' ? (
                            <Input
                              value={(header.column.getFilterValue() as string) ?? ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                header.column.setFilterValue(e.target.value)
                              }
                              onPressEnter={() => {
                                applyFilters();
                              }}
                              placeholder="Поиск..."
                              className="nd-norms-table-filter-input"
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

          <div className="nd-norms-table-pagination">
            <div className="nd-norms-table-pagination-info">
              Показано {table.getRowModel().rows.length} из {totalRecords} записей
            </div>

            <div className="nd-norms-table-pagination-controls">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="nd-norms-table-pagination-icon"
                type="button"
              >
                <BiChevronsLeft size={20} />
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="nd-norms-table-pagination-icon"
                type="button"
              >
                <BiChevronLeft size={20} />
              </button>

              <span className="nd-norms-table-pagination-page-info">
                Страница {pagination.pageIndex + 1} из {totalPages}
              </span>

              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="nd-norms-table-pagination-icon"
                type="button"
              >
                <BiChevronRight size={20} />
              </button>
              <button
                onClick={() => table.setPageIndex(totalPages - 1)}
                disabled={!table.getCanNextPage()}
                className="nd-norms-table-pagination-icon"
                type="button"
              >
                <BiChevronsRight size={20} />
              </button>

              <Select
                value={pagination.pageSize}
                onChange={(value: unknown) => {
                  table.setPageSize(value as number);
                }}
                className="nd-norms-table-page-size-select"
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

export default NdNormsTable;
