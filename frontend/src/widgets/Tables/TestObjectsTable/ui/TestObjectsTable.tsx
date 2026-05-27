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
import { BiChevronLeft, BiChevronRight, BiChevronsLeft, BiChevronsRight } from 'react-icons/bi';
import { FaSortUp, FaSortDown, FaSort } from 'react-icons/fa';
import { LoadingCard } from '../../../../features/Cards';
import { urlParamsToFilters } from '../../../../shared/lib/urlParams';
import Button from '../../../../shared/ui/Button/Button';
import { Input, Select } from '../../../../shared/ui/FormItems';
import type { TestObjectCatalogItem } from '../../../../shared/api/testObjects';
import './TestObjectsTable.css';

interface TestObjectsTableProps {
  data: TestObjectCatalogItem[];
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
}

const formatVisibilityScope = (item: TestObjectCatalogItem): string => {
  const scope = item.visibility_scope;
  const hasLabs = (scope.laboratory_ids?.length || 0) > 0;
  const hasDepartments = (scope.department_ids?.length || 0) > 0;

  if (!hasLabs && !hasDepartments) {
    return 'Все лаборатории и подразделения';
  }

  const parts: string[] = [];

  scope.laboratories?.forEach(entry => {
    parts.push(entry.name);
  });

  scope.departments?.forEach(entry => {
    parts.push(entry.name);
  });

  if (parts.length === 0) {
    const labIds = scope.laboratory_ids?.join(', ') || '';
    const deptIds = scope.department_ids?.join(', ') || '';
    if (labIds) {
      parts.push(`Лаборатории: ${labIds}`);
    }
    if (deptIds) {
      parts.push(`Подразделения: ${deptIds}`);
    }
  }

  return parts.join('; ');
};

const TestObjectsTable: React.FC<TestObjectsTableProps> = ({
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
  const [searchParams] = useSearchParams();
  const filterKeys = React.useMemo(() => ['name', 'tag'], []);

  const urlFiltersToColumnFilters = React.useCallback((): ColumnFiltersState => {
    const urlFilters = urlParamsToFilters(searchParams, filterKeys);
    const columnFilters: ColumnFiltersState = [];

    if (urlFilters.name && typeof urlFilters.name === 'string') {
      columnFilters.push({ id: 'name', value: urlFilters.name });
    }

    if (urlFilters.tag && typeof urlFilters.tag === 'string') {
      columnFilters.push({ id: 'tag', value: urlFilters.tag });
    }

    return columnFilters;
  }, [searchParams, filterKeys]);

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(() =>
    urlFiltersToColumnFilters()
  );
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(externalSorting || []);
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const tableRef = React.useRef<ReturnType<typeof useReactTable<TestObjectCatalogItem>> | null>(
    null
  );

  React.useEffect(() => {
    if (externalSorting !== undefined) {
      setInternalSorting(externalSorting);
    }
  }, [externalSorting]);

  const previousFiltersRef = React.useRef<string>('');
  const searchParamsStr = searchParams.toString();

  React.useEffect(() => {
    const newFilters = urlFiltersToColumnFilters();
    const newStr = JSON.stringify(newFilters);
    if (previousFiltersRef.current !== newStr) {
      previousFiltersRef.current = newStr;
      setColumnFilters(newFilters);
    }
  }, [searchParamsStr, urlFiltersToColumnFilters]);

  const handleSortingChange = React.useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const newSorting = typeof updater === 'function' ? updater(internalSorting) : updater;
      setInternalSorting(newSorting);
      onSortingChange?.(newSorting);
    },
    [internalSorting, onSortingChange]
  );

  const columns = React.useMemo<ColumnDef<TestObjectCatalogItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Наименование',
        cell: ({ row }) => row.original.name || '-',
        enableSorting: true,
        enableColumnFilter: true,
        size: 280,
      },
      {
        accessorKey: 'tag',
        header: 'Тег',
        cell: ({ row }) => row.original.tag || '-',
        enableSorting: true,
        enableColumnFilter: true,
        size: 220,
      },
      {
        id: 'visibility_scope',
        header: 'Область видимости',
        cell: ({ row }) => formatVisibilityScope(row.original),
        enableSorting: false,
        enableColumnFilter: false,
        size: 360,
      },
      {
        id: 'actions',
        header: 'Действия',
        cell: ({ row }) => (
          <div className="test-objects-table-actions">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(row.original.id)}
              className="test-objects-table-edit-button"
            >
              Редактировать
            </Button>
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => onDelete(row.original.id)}
              className="test-objects-table-delete-button"
            >
              Удалить
            </Button>
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        size: 220,
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

  const table = useReactTable<TestObjectCatalogItem>({
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

  const pageSizeOptions = React.useMemo(() => [10, 20, 50, 100], []);

  return (
    <div className="test-objects-table-container">
      <LoadingCard loading={loading} />
      {!loading && (
        <>
          <div className="test-objects-table-wrapper">
            <table className="test-objects-table">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <React.Fragment key={headerGroup.id}>
                    <tr className="test-objects-table-header-row">
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          style={{ width: header.getSize(), position: 'relative' }}
                          className={header.column.getIsResizing() ? 'is-resizing' : ''}
                        >
                          <div
                            className={`test-objects-table-header-content ${
                              header.column.getCanSort() ? 'sortable' : ''
                            }`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="test-objects-table-sort-icon">
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
                              className={`test-objects-table-resizer ${
                                header.column.getIsResizing() ? 'isResizing' : ''
                              }`}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                    <tr className="test-objects-table-filter-row">
                      {headerGroup.headers.map(header => (
                        <th key={`filter-${header.id}`} className="test-objects-table-filter-cell">
                          {header.column.getCanFilter() ? (
                            <Input
                              value={(header.column.getFilterValue() as string) ?? ''}
                              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                                header.column.setFilterValue(event.target.value)
                              }
                              onPressEnter={() => {
                                applyFilters();
                              }}
                              placeholder="Поиск..."
                              className="test-objects-table-filter-input"
                              onClick={(event: React.MouseEvent<HTMLInputElement>) =>
                                event.stopPropagation()
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
                    <td colSpan={columns.length} className="test-objects-table-empty-cell">
                      Объекты испытаний не найдены
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

          <div className="test-objects-table-pagination">
            <div className="test-objects-table-pagination-info">
              Показано {table.getRowModel().rows.length} из {totalRecords} записей
            </div>

            <div className="test-objects-table-pagination-controls">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="test-objects-table-pagination-icon"
                type="button"
              >
                <BiChevronsLeft size={20} />
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="test-objects-table-pagination-icon"
                type="button"
              >
                <BiChevronLeft size={20} />
              </button>

              <span className="test-objects-table-pagination-page-info">
                Страница {pagination.pageIndex + 1} из {totalPages || 1}
              </span>

              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="test-objects-table-pagination-icon"
                type="button"
              >
                <BiChevronRight size={20} />
              </button>
              <button
                onClick={() => table.setPageIndex(totalPages - 1)}
                disabled={!table.getCanNextPage()}
                className="test-objects-table-pagination-icon"
                type="button"
              >
                <BiChevronsRight size={20} />
              </button>

              <Select
                value={pagination.pageSize}
                onChange={(value: unknown) => {
                  table.setPageSize(value as number);
                }}
                className="test-objects-table-page-size-select"
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

export default TestObjectsTable;
