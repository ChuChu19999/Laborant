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
import { LoadingCard } from '../../../features/Cards';
import { type Equipment } from '../../../shared/api/equipment';
import { getDateRangePresets } from '../../../shared/lib/datePresets';
import { urlParamsToFilters } from '../../../shared/lib/urlParams';
import Button from '../../../shared/ui/Button/Button';
import { Input, Select, RangePicker } from '../../../shared/ui/FormItems';
import './EquipmentTable.css';

const EQUIPMENT_TYPES = [
  { value: 'measuring_instrument', label: 'Средство измерения' },
  { value: 'test_equipment', label: 'Испытательное оборудование' },
];

dayjs.extend(customParseFormat);

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
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  return dayjs(dateString).format('DD.MM.YYYY');
};

const formatEquipmentType = (type: string): string => {
  const types: Record<string, string> = {
    measuring_instrument: 'Средство измерения',
    test_equipment: 'Испытательное оборудование',
  };
  return types[type] || type;
};

const EquipmentTable: React.FC<EquipmentTableProps> = ({
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
      'name',
      'serial_number',
      'type',
      'types',
      'verification_date_from',
      'verification_date_to',
      'verification_end_date_from',
      'verification_end_date_to',
      'created_at_from',
      'created_at_to',
    ],
    []
  );

  const urlFiltersToColumnFilters = React.useCallback((): ColumnFiltersState => {
    const urlFilters = urlParamsToFilters(searchParams, filterKeys);
    const columnFilters: ColumnFiltersState = [];

    if (urlFilters.name && typeof urlFilters.name === 'string') {
      columnFilters.push({ id: 'name', value: urlFilters.name });
    }
    if (urlFilters.serial_number && typeof urlFilters.serial_number === 'string') {
      columnFilters.push({ id: 'serial_number', value: urlFilters.serial_number });
    }
    if (urlFilters.type || urlFilters.types) {
      const typeArray = Array.isArray(urlFilters.types)
        ? urlFilters.types
        : Array.isArray(urlFilters.type)
          ? urlFilters.type
          : urlFilters.type
            ? [urlFilters.type]
            : [];
      if (typeArray.length > 0) {
        columnFilters.push({ id: 'type', value: typeArray });
      }
    }

    const verificationFrom = urlFilters.verification_date_from;
    const verificationTo = urlFilters.verification_date_to;
    if (verificationFrom || verificationTo) {
      const startDate =
        verificationFrom && typeof verificationFrom === 'string' ? dayjs(verificationFrom) : null;
      const endDate =
        verificationTo && typeof verificationTo === 'string' ? dayjs(verificationTo) : null;
      if (startDate || endDate) {
        columnFilters.push({ id: 'verification_date', value: [startDate, endDate] });
      }
    }

    const verificationEndFrom = urlFilters.verification_end_date_from;
    const verificationEndTo = urlFilters.verification_end_date_to;
    if (verificationEndFrom || verificationEndTo) {
      const startDate =
        verificationEndFrom && typeof verificationEndFrom === 'string'
          ? dayjs(verificationEndFrom)
          : null;
      const endDate =
        verificationEndTo && typeof verificationEndTo === 'string'
          ? dayjs(verificationEndTo)
          : null;
      if (startDate || endDate) {
        columnFilters.push({ id: 'verification_end_date', value: [startDate, endDate] });
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

  const initialFilters = React.useMemo(() => {
    const filters = urlFiltersToColumnFilters();
    const typeFilter = filters.find(f => f.id === 'type');
    return {
      typeFilter:
        typeFilter && Array.isArray(typeFilter.value) ? (typeFilter.value as string[]) : [],
    };
  }, [urlFiltersToColumnFilters]);

  const [tempTypeFilter, setTempTypeFilter] = React.useState<string[]>(initialFilters.typeFilter);
  const tempTypeFilterRef = React.useRef<string[]>(initialFilters.typeFilter);

  const previousFiltersRef = React.useRef<string>('');
  const searchParamsStr = searchParams.toString();
  React.useEffect(() => {
    const newFilters = urlFiltersToColumnFilters();
    const newStr = JSON.stringify(newFilters);
    if (previousFiltersRef.current !== newStr) {
      previousFiltersRef.current = newStr;
      setColumnFilters(newFilters);

      const typeFilter = newFilters.find(f => f.id === 'type');
      const newTypeFilter =
        typeFilter && Array.isArray(typeFilter.value) ? (typeFilter.value as string[]) : [];
      setTempTypeFilter(newTypeFilter);
      tempTypeFilterRef.current = newTypeFilter;
    }
  }, [searchParamsStr, urlFiltersToColumnFilters]);

  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const tableRef = React.useRef<ReturnType<typeof useReactTable<Equipment>> | null>(null);

  const columns = React.useMemo<ColumnDef<Equipment>[]>(
    () => [
      {
        accessorKey: 'type',
        header: 'Тип',
        cell: ({ row }) => formatEquipmentType(row.original.type),
        enableSorting: true,
        enableColumnFilter: true,
        size: 200,
      },
      {
        accessorKey: 'name',
        header: 'Наименование',
        cell: ({ row }) => row.original.name || '-',
        enableSorting: true,
        enableColumnFilter: true,
        size: 250,
      },
      {
        accessorKey: 'serial_number',
        header: 'Заводской номер',
        cell: ({ row }) => row.original.serial_number || '-',
        enableSorting: true,
        enableColumnFilter: true,
        size: 180,
      },
      {
        accessorKey: 'verification_date',
        header: 'Дата поверки',
        cell: ({ row }) => formatDate(row.original.verification_date),
        enableSorting: true,
        enableColumnFilter: true,
        size: 150,
        filterFn: (row, _id, filterValue) => {
          if (!filterValue) return true;
          if (!row.original.verification_date) return false;

          const rowDate = dayjs(row.original.verification_date);

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
        accessorKey: 'verification_end_date',
        header: 'Дата окончания поверки',
        cell: ({ row }) => formatDate(row.original.verification_end_date),
        enableSorting: true,
        enableColumnFilter: true,
        size: 200,
        filterFn: (row, _id, filterValue) => {
          if (!filterValue) return true;
          if (!row.original.verification_end_date) return false;

          const rowDate = dayjs(row.original.verification_end_date);

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
          <div className="equipment-table-actions">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(row.original.id)}
              className="equipment-table-edit-button"
            >
              Редактировать
            </Button>
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => onDelete(row.original.id)}
              className="equipment-table-delete-button"
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
    [onEdit, onDelete]
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

  const pageSizeOptions = React.useMemo(() => [10, 20, 50, 100], []);

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
                          style={{ width: header.getSize(), position: 'relative' }}
                          className={header.column.getIsResizing() ? 'is-resizing' : ''}
                        >
                          <div
                            className={`equipment-table-header-content ${
                              header.column.getCanSort() ? 'sortable' : ''
                            }`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="equipment-table-sort-icon">
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
                              className={`equipment-table-resizer ${
                                header.column.getIsResizing() ? 'isResizing' : ''
                              }`}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                    <tr className="equipment-table-filter-row">
                      {headerGroup.headers.map(header => (
                        <th key={`filter-${header.id}`} className="equipment-table-filter-cell">
                          {header.column.getCanFilter() &&
                          (header.column.id === 'verification_date' ||
                            header.column.id === 'verification_end_date' ||
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
                              className="equipment-table-filter-datepicker"
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              allowClear
                              presets={getDateRangePresets()}
                            />
                          ) : header.column.getCanFilter() && header.column.id === 'type' ? (
                            <Select
                              mode="multiple"
                              value={tempTypeFilter}
                              onChange={(value: unknown) => {
                                const newValue = value as string[];
                                setTempTypeFilter(newValue);
                                tempTypeFilterRef.current = newValue;
                              }}
                              onDeselect={(value: unknown) => {
                                const newValue = tempTypeFilter.filter(v => v !== value);
                                setTempTypeFilter(newValue);
                                tempTypeFilterRef.current = newValue;
                                applyFiltersWithNewValue(header.column.id, newValue);
                              }}
                              onDropdownVisibleChange={(open: boolean) => {
                                if (!open) {
                                  applyFiltersWithNewValue(
                                    header.column.id,
                                    tempTypeFilterRef.current
                                  );
                                }
                              }}
                              placeholder="Выберите типы"
                              className="equipment-table-filter-select"
                              classNames={{
                                popup: { root: 'equipment-table-filter-select-dropdown' },
                              }}
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              allowClear
                              onClear={() => {
                                setTempTypeFilter([]);
                                tempTypeFilterRef.current = [];
                                applyFiltersWithNewValue(header.column.id, []);
                              }}
                              options={EQUIPMENT_TYPES}
                              optionRender={option => {
                                const isSelected = tempTypeFilter.includes(option.value as string);
                                return (
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                    }}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onClick={e => {
                                        e.stopPropagation();
                                        const newValue = isSelected
                                          ? tempTypeFilter.filter(v => v !== option.value)
                                          : [...tempTypeFilter, option.value as string];
                                        setTempTypeFilter(newValue);
                                        tempTypeFilterRef.current = newValue;
                                      }}
                                    />
                                    <span>{option.label}</span>
                                  </div>
                                );
                              }}
                              style={{ width: '100%' }}
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
                              className="equipment-table-filter-input"
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

          <div className="equipment-table-pagination">
            <div className="equipment-table-pagination-info">
              Показано {table.getRowModel().rows.length} из {totalRecords} записей
            </div>

            <div className="equipment-table-pagination-controls">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="equipment-table-pagination-icon"
                type="button"
              >
                <BiChevronsLeft size={20} />
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="equipment-table-pagination-icon"
                type="button"
              >
                <BiChevronLeft size={20} />
              </button>

              <span className="equipment-table-pagination-page-info">
                Страница {pagination.pageIndex + 1} из {totalPages}
              </span>

              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="equipment-table-pagination-icon"
                type="button"
              >
                <BiChevronRight size={20} />
              </button>
              <button
                onClick={() => table.setPageIndex(totalPages - 1)}
                disabled={!table.getCanNextPage()}
                className="equipment-table-pagination-icon"
                type="button"
              >
                <BiChevronsRight size={20} />
              </button>

              <Select
                value={pagination.pageSize}
                onChange={(value: unknown) => {
                  table.setPageSize(value as number);
                }}
                className="equipment-table-page-size-select"
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

export default EquipmentTable;
