import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { DeleteOutlined, EditOutlined, CalculatorOutlined } from '@ant-design/icons';
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
import { type Sample, samplesApi } from '../../../shared/api/samples';
import { getDateRangePresets } from '../../../shared/lib/datePresets';
import { urlParamsToFilters } from '../../../shared/lib/urlParams';
import { useAutoRefetchQuery } from '../../../shared/model/lib';
import Button from '../../../shared/ui/Button/Button';
import { Input, Select, RangePicker } from '../../../shared/ui/FormItems';
import './SamplesTable.css';

dayjs.extend(customParseFormat);

interface SamplesTableProps {
  data: Sample[];
  loading?: boolean;
  pagination: PaginationState;
  totalPages: number;
  totalRecords: number;
  onPaginationChange: OnChangeFn<PaginationState>;
  onFiltersChange?: (filters: ColumnFiltersState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  sorting?: SortingState;
  onEdit: (sampleId: number) => void;
  onDelete: (sampleId: number) => void;
  onFillCalculations?: (sampleId: number) => void;
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  return dayjs(dateString).format('DD.MM.YYYY');
};

const formatProtocolNumber = (
  number?: string,
  date?: string,
  isAccredited?: boolean,
  testObject?: string
): string => {
  if (!number && !date) return '-';
  if (!isAccredited) return number || '-';

  const getObjectSuffix = (): string => {
    if (!testObject) return '';

    const testObjectLower = testObject.toLowerCase();
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

const SamplesTable: React.FC<SamplesTableProps> = ({
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
  onFillCalculations,
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
      'registration_number',
      'sample_type',
      'sample_types',
      'test_object',
      'test_objects',
      'sampling_location',
      'sampling_date_from',
      'sampling_date_to',
      'receiving_date_from',
      'receiving_date_to',
      'created_at_from',
      'created_at_to',
    ],
    []
  );

  const urlFiltersToColumnFilters = React.useCallback((): ColumnFiltersState => {
    const urlFilters = urlParamsToFilters(searchParams, filterKeys);
    const columnFilters: ColumnFiltersState = [];

    if (urlFilters.registration_number && typeof urlFilters.registration_number === 'string') {
      columnFilters.push({ id: 'registration_number', value: urlFilters.registration_number });
    }
    if (urlFilters.sample_type || urlFilters.sample_types) {
      const sampleTypeArray = Array.isArray(urlFilters.sample_types)
        ? urlFilters.sample_types
        : Array.isArray(urlFilters.sample_type)
          ? urlFilters.sample_type
          : urlFilters.sample_type
            ? [urlFilters.sample_type]
            : [];
      if (sampleTypeArray.length > 0) {
        columnFilters.push({ id: 'sample_type', value: sampleTypeArray });
      }
    }
    if (urlFilters.test_object || urlFilters.test_objects) {
      const testObjectArray = Array.isArray(urlFilters.test_objects)
        ? urlFilters.test_objects
        : Array.isArray(urlFilters.test_object)
          ? urlFilters.test_object
          : urlFilters.test_object
            ? [urlFilters.test_object]
            : [];
      if (testObjectArray.length > 0) {
        columnFilters.push({ id: 'test_object', value: testObjectArray });
      }
    }
    if (urlFilters.sampling_location && typeof urlFilters.sampling_location === 'string') {
      columnFilters.push({ id: 'sampling_location', value: urlFilters.sampling_location });
    }

    const samplingFrom = urlFilters.sampling_date_from;
    const samplingTo = urlFilters.sampling_date_to;
    if (samplingFrom || samplingTo) {
      const startDate =
        samplingFrom && typeof samplingFrom === 'string' ? dayjs(samplingFrom) : null;
      const endDate = samplingTo && typeof samplingTo === 'string' ? dayjs(samplingTo) : null;
      if (startDate || endDate) {
        columnFilters.push({ id: 'sampling_date', value: [startDate, endDate] });
      }
    }

    const receivingFrom = urlFilters.receiving_date_from;
    const receivingTo = urlFilters.receiving_date_to;
    if (receivingFrom || receivingTo) {
      const startDate =
        receivingFrom && typeof receivingFrom === 'string' ? dayjs(receivingFrom) : null;
      const endDate = receivingTo && typeof receivingTo === 'string' ? dayjs(receivingTo) : null;
      if (startDate || endDate) {
        columnFilters.push({ id: 'receiving_date', value: [startDate, endDate] });
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
    const sampleTypeFilter = filters.find(f => f.id === 'sample_type');
    const testObjectFilter = filters.find(f => f.id === 'test_object');
    return {
      sampleTypeFilter:
        sampleTypeFilter && Array.isArray(sampleTypeFilter.value)
          ? (sampleTypeFilter.value as string[])
          : [],
      testObjectFilter:
        testObjectFilter && Array.isArray(testObjectFilter.value)
          ? (testObjectFilter.value as string[])
          : [],
    };
  }, [urlFiltersToColumnFilters]);

  const [tempSampleTypeFilter, setTempSampleTypeFilter] = React.useState<string[]>(
    initialFilters.sampleTypeFilter
  );
  const [tempTestObjectFilter, setTempTestObjectFilter] = React.useState<string[]>(
    initialFilters.testObjectFilter
  );
  const tempSampleTypeFilterRef = React.useRef<string[]>(initialFilters.sampleTypeFilter);
  const tempTestObjectFilterRef = React.useRef<string[]>(initialFilters.testObjectFilter);

  const previousFiltersRef = React.useRef<string>('');
  const searchParamsStr = searchParams.toString();
  React.useEffect(() => {
    const newFilters = urlFiltersToColumnFilters();
    const newStr = JSON.stringify(newFilters);
    if (previousFiltersRef.current !== newStr) {
      previousFiltersRef.current = newStr;
      setColumnFilters(newFilters);

      const sampleTypeFilter = newFilters.find(f => f.id === 'sample_type');
      const testObjectFilter = newFilters.find(f => f.id === 'test_object');
      const newSampleTypeFilter =
        sampleTypeFilter && Array.isArray(sampleTypeFilter.value)
          ? (sampleTypeFilter.value as string[])
          : [];
      const newTestObjectFilter =
        testObjectFilter && Array.isArray(testObjectFilter.value)
          ? (testObjectFilter.value as string[])
          : [];
      setTempSampleTypeFilter(newSampleTypeFilter);
      setTempTestObjectFilter(newTestObjectFilter);
      tempSampleTypeFilterRef.current = newSampleTypeFilter;
      tempTestObjectFilterRef.current = newTestObjectFilter;
    }
  }, [searchParamsStr, urlFiltersToColumnFilters]);

  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const tableRef = React.useRef<ReturnType<typeof useReactTable<Sample>> | null>(null);

  const columns = React.useMemo<ColumnDef<Sample>[]>(
    () => [
      {
        accessorKey: 'registration_number',
        header: '№ пробы',
        cell: ({ row }) => row.original.registration_number || '-',
        enableSorting: true,
        enableColumnFilter: true,
        size: 120,
      },
      {
        accessorKey: 'sample_type',
        header: 'Тип пробы',
        cell: ({ row }) => row.original.sample_type || '-',
        enableSorting: true,
        enableColumnFilter: true,
        size: 160,
      },
      {
        accessorKey: 'test_object',
        header: 'Объект испытания',
        cell: ({ row }) => row.original.test_object || '-',
        enableSorting: true,
        enableColumnFilter: true,
        size: 160,
      },
      {
        id: 'sampling_location',
        header: 'Место отбора',
        accessorFn: row => {
          const parts: string[] = [];
          if (row.sampling_location_name) {
            parts.push(row.sampling_location_name);
          }
          if (row.well) {
            parts.push(`скв. ${row.well}`);
          }
          if (row.mode) {
            parts.push(row.mode);
          }
          return parts.length > 0 ? parts.join(' ') : '';
        },
        cell: ({ row }) => {
          const parts: string[] = [];
          if (row.original.sampling_location_name) {
            parts.push(row.original.sampling_location_name);
          }
          if (row.original.well) {
            parts.push(`скв. ${row.original.well}`);
          }
          if (row.original.mode) {
            parts.push(row.original.mode);
          }
          return parts.length > 0 ? parts.join(' ') : '-';
        },
        enableSorting: true,
        enableColumnFilter: true,
        size: 160,
      },
      {
        accessorKey: 'sampling_date',
        header: 'Дата отбора',
        cell: ({ row }) => formatDate(row.original.sampling_date),
        enableSorting: true,
        enableColumnFilter: true,
        size: 180,
        filterFn: (row, _id, filterValue) => {
          if (!filterValue) return true;
          if (!row.original.sampling_date) return false;

          const rowDate = dayjs(row.original.sampling_date);

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
        accessorKey: 'receiving_date',
        header: 'Дата получения',
        cell: ({ row }) => formatDate(row.original.receiving_date),
        enableSorting: true,
        enableColumnFilter: true,
        size: 180,
        filterFn: (row, _id, filterValue) => {
          if (!filterValue) return true;
          if (!row.original.receiving_date) return false;

          const rowDate = dayjs(row.original.receiving_date);

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
        id: 'protocols',
        header: 'Протоколы',
        accessorFn: row => {
          if (!row.protocols || !Array.isArray(row.protocols) || row.protocols.length === 0) {
            return '';
          }
          return row.protocols
            .map(
              (p: {
                test_protocol_number?: string;
                test_protocol_date?: string;
                is_accredited?: boolean;
              }) =>
                formatProtocolNumber(
                  p.test_protocol_number,
                  p.test_protocol_date,
                  p.is_accredited,
                  row.test_object
                )
            )
            .filter((formatted: string) => formatted !== '-')
            .join(', ');
        },
        cell: ({ row }) => {
          if (
            !row.original.protocols ||
            !Array.isArray(row.original.protocols) ||
            row.original.protocols.length === 0
          ) {
            return '-';
          }
          const formatted = row.original.protocols
            .map(
              (p: {
                test_protocol_number?: string;
                test_protocol_date?: string;
                is_accredited?: boolean;
              }) =>
                formatProtocolNumber(
                  p.test_protocol_number,
                  p.test_protocol_date,
                  p.is_accredited,
                  row.original.test_object
                )
            )
            .filter((formatted: string) => formatted !== '-');
          return formatted.length > 0 ? formatted.join(', ') : '-';
        },
        enableSorting: true,
        enableColumnFilter: true,
        size: 200,
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
          <div className="samples-table-actions">
            {onFillCalculations && (
              <Button
                type="text"
                size="small"
                icon={<CalculatorOutlined />}
                onClick={() => onFillCalculations(row.original.id)}
                className="samples-table-edit-button"
              >
                Расчеты
              </Button>
            )}
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(row.original.id)}
              className="samples-table-edit-button"
            >
              Редактировать
            </Button>
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => onDelete(row.original.id)}
              className="samples-table-delete-button"
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
    [onEdit, onDelete, onFillCalculations]
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

  const pageSizeOptions = React.useMemo(() => [10, 20, 50, 100], []);

  const { data: sampleTypes = [] } = useAutoRefetchQuery<string[]>(['sample-types'], () =>
    samplesApi.getSampleTypes()
  );

  const uniqueTestObjects = React.useMemo(() => {
    const objects = new Set<string>();
    data.forEach(sample => {
      if (sample.test_object) {
        objects.add(sample.test_object);
      }
    });
    return Array.from(objects).sort();
  }, [data]);

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
                          style={{ width: header.getSize(), position: 'relative' }}
                          className={header.column.getIsResizing() ? 'is-resizing' : ''}
                        >
                          <div
                            className={`samples-table-header-content ${
                              header.column.getCanSort() ? 'sortable' : ''
                            }`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="samples-table-sort-icon">
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
                              className={`samples-table-resizer ${
                                header.column.getIsResizing() ? 'isResizing' : ''
                              }`}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                    <tr className="samples-table-filter-row">
                      {headerGroup.headers.map(header => (
                        <th key={`filter-${header.id}`} className="samples-table-filter-cell">
                          {header.column.getCanFilter() &&
                          (header.column.id === 'sampling_date' ||
                            header.column.id === 'receiving_date' ||
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
                              className="samples-table-filter-datepicker"
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              allowClear
                              presets={getDateRangePresets()}
                            />
                          ) : header.column.getCanFilter() && header.column.id === 'sample_type' ? (
                            <Select
                              mode="multiple"
                              value={tempSampleTypeFilter}
                              onChange={(value: unknown) => {
                                const newValue = value as string[];
                                setTempSampleTypeFilter(newValue);
                                tempSampleTypeFilterRef.current = newValue;
                              }}
                              onDeselect={(value: unknown) => {
                                const newValue = tempSampleTypeFilter.filter(v => v !== value);
                                setTempSampleTypeFilter(newValue);
                                tempSampleTypeFilterRef.current = newValue;
                                applyFiltersWithNewValue(header.column.id, newValue);
                              }}
                              onDropdownVisibleChange={(open: boolean) => {
                                if (!open) {
                                  applyFiltersWithNewValue(
                                    header.column.id,
                                    tempSampleTypeFilterRef.current
                                  );
                                }
                              }}
                              placeholder="Выберите типы"
                              className="samples-table-filter-select"
                              classNames={{
                                popup: { root: 'samples-table-filter-select-dropdown' },
                              }}
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              allowClear
                              onClear={() => {
                                setTempSampleTypeFilter([]);
                                tempSampleTypeFilterRef.current = [];
                                applyFiltersWithNewValue(header.column.id, []);
                              }}
                              options={sampleTypes.map(type => ({
                                label: type,
                                value: type,
                              }))}
                              optionRender={option => {
                                const isSelected = tempSampleTypeFilter.includes(
                                  option.value as string
                                );
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
                                          ? tempSampleTypeFilter.filter(v => v !== option.value)
                                          : [...tempSampleTypeFilter, option.value as string];
                                        setTempSampleTypeFilter(newValue);
                                        tempSampleTypeFilterRef.current = newValue;
                                      }}
                                    />
                                    <span>{option.label}</span>
                                  </div>
                                );
                              }}
                              style={{ width: '100%' }}
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
                                const newValue = tempTestObjectFilter.filter(v => v !== value);
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
                              className="samples-table-filter-select"
                              classNames={{
                                popup: { root: 'samples-table-filter-select-dropdown' },
                              }}
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
                              options={uniqueTestObjects.map(obj => ({
                                label: obj,
                                value: obj,
                              }))}
                              optionRender={option => {
                                const isSelected = tempTestObjectFilter.includes(
                                  option.value as string
                                );
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
                                          ? tempTestObjectFilter.filter(v => v !== option.value)
                                          : [...tempTestObjectFilter, option.value as string];
                                        setTempTestObjectFilter(newValue);
                                        tempTestObjectFilterRef.current = newValue;
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
                              className="samples-table-filter-input"
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
                    <td colSpan={columns.length} className="samples-table-empty-cell">
                      Пробы не найдены
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

          <div className="samples-table-pagination">
            <div className="samples-table-pagination-info">
              Показано {table.getRowModel().rows.length} из {totalRecords} записей
            </div>

            <div className="samples-table-pagination-controls">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="samples-table-pagination-icon"
                type="button"
              >
                <BiChevronsLeft size={20} />
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="samples-table-pagination-icon"
                type="button"
              >
                <BiChevronLeft size={20} />
              </button>

              <span className="samples-table-pagination-page-info">
                Страница {pagination.pageIndex + 1} из {totalPages}
              </span>

              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="samples-table-pagination-icon"
                type="button"
              >
                <BiChevronRight size={20} />
              </button>
              <button
                onClick={() => table.setPageIndex(totalPages - 1)}
                disabled={!table.getCanNextPage()}
                className="samples-table-pagination-icon"
                type="button"
              >
                <BiChevronsRight size={20} />
              </button>

              <Select
                value={pagination.pageSize}
                onChange={(value: unknown) => {
                  table.setPageSize(value as number);
                }}
                className="samples-table-page-size-select"
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

export default SamplesTable;
