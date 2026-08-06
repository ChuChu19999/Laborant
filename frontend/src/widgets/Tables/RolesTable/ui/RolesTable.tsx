import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { DeleteOutlined, EditOutlined, SettingOutlined } from '@ant-design/icons';
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
import { formatRoleType, ROLE_TYPE_OPTIONS } from '../../../../shared/lib/roleTypeOptions';
import { urlParamsToFilters } from '../../../../shared/lib/urlParams';
import Button from '../../../../shared/ui/Button';
import { Input, Select } from '../../../../shared/ui/FormItems';
import type { RoleCatalogItem } from '../../../../shared/api/roles';
import './RolesTable.css';

interface RolesTableProps {
  data: RoleCatalogItem[];
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
  onConfigure: (id: number) => void;
}

const formatVisibilityScope = (item: RoleCatalogItem): string => {
  const scopes = item.scopes || [];
  if (scopes.length === 0) {
    return 'Нет доступа';
  }

  const parts: string[] = [];
  scopes.forEach(scope => {
    if (scope.department_name) {
      parts.push(scope.department_name);
      return;
    }
    if (scope.laboratory_name) {
      parts.push(scope.laboratory_name);
      return;
    }
    if (scope.department_id != null) {
      parts.push(`Подразделение #${scope.department_id}`);
      return;
    }
    parts.push(`Лаборатория #${scope.laboratory_id}`);
  });

  return parts.join('; ');
};

const RolesTable: React.FC<RolesTableProps> = ({
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
  onConfigure,
}) => {
  const [searchParams] = useSearchParams();
  const filterKeys = React.useMemo(() => ['name', 'role_type'], []);

  const urlFiltersToColumnFilters = React.useCallback((): ColumnFiltersState => {
    const urlFilters = urlParamsToFilters(searchParams, filterKeys);
    const columnFilters: ColumnFiltersState = [];

    if (urlFilters.name && typeof urlFilters.name === 'string') {
      columnFilters.push({ id: 'name', value: urlFilters.name });
    }

    if (urlFilters.role_type && typeof urlFilters.role_type === 'string') {
      columnFilters.push({ id: 'role_type', value: urlFilters.role_type });
    }

    return columnFilters;
  }, [searchParams, filterKeys]);

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(() =>
    urlFiltersToColumnFilters()
  );
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(externalSorting || []);
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const tableRef = React.useRef<ReturnType<typeof useReactTable<RoleCatalogItem>> | null>(null);

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

  const columns = React.useMemo<ColumnDef<RoleCatalogItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Роль',
        cell: ({ row }) => row.original.name || '-',
        enableSorting: true,
        enableColumnFilter: true,
        size: 260,
      },
      {
        accessorKey: 'role_type',
        header: 'Тип роли',
        cell: ({ row }) => formatRoleType(row.original.role_type),
        enableSorting: true,
        enableColumnFilter: true,
        size: 180,
      },
      {
        id: 'visibility_scope',
        header: 'Лаборатории / подразделения',
        cell: ({ row }) => formatVisibilityScope(row.original),
        enableSorting: false,
        enableColumnFilter: false,
        size: 360,
      },
      {
        id: 'actions',
        header: 'Действия',
        cell: ({ row }) => (
          <div className="roles-table-actions">
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              onClick={() => onConfigure(row.original.id)}
              className="roles-table-configure-button"
            >
              Настроить
            </Button>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(row.original.id)}
              className="roles-table-edit-button"
            >
              Редактировать
            </Button>
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => onDelete(row.original.id)}
              className="roles-table-delete-button"
            >
              Удалить
            </Button>
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        size: 320,
        enableResizing: false,
      },
    ],
    [onEdit, onDelete, onConfigure]
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

  const table = useReactTable<RoleCatalogItem>({
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
    <div className="roles-table-container">
      <LoadingCard loading={loading} />
      {!loading && (
        <>
          <div className="roles-table-wrapper">
            <table className="roles-table">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <React.Fragment key={headerGroup.id}>
                    <tr className="roles-table-header-row">
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          style={{ width: header.getSize(), position: 'relative' }}
                          className={header.column.getIsResizing() ? 'is-resizing' : ''}
                        >
                          <div
                            className={`roles-table-header-content ${
                              header.column.getCanSort() ? 'sortable' : ''
                            }`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="roles-table-sort-icon">
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
                              className={`roles-table-resizer ${
                                header.column.getIsResizing() ? 'isResizing' : ''
                              }`}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                    <tr className="roles-table-filter-row">
                      {headerGroup.headers.map(header => (
                        <th key={`filter-${header.id}`} className="roles-table-filter-cell">
                          {header.column.getCanFilter() ? (
                            header.id === 'role_type' ? (
                              <Select
                                value={(header.column.getFilterValue() as string) || undefined}
                                onChange={(value: unknown) => {
                                  header.column.setFilterValue(value || undefined);
                                  setTimeout(() => applyFilters(), 0);
                                }}
                                placeholder="Все типы"
                                allowClear
                                className="roles-table-filter-input"
                                options={ROLE_TYPE_OPTIONS}
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
                                placeholder="Поиск..."
                                className="roles-table-filter-input"
                                onClick={(event: React.MouseEvent<HTMLInputElement>) =>
                                  event.stopPropagation()
                                }
                                allowClear
                              />
                            )
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
                    <td colSpan={columns.length} className="roles-table-empty-cell">
                      Области видимости ролей не найдены
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

          <div className="roles-table-pagination">
            <div className="roles-table-pagination-info">
              Показано {table.getRowModel().rows.length} из {totalRecords} записей
            </div>

            <div className="roles-table-pagination-controls">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="roles-table-pagination-icon"
                type="button"
              >
                <BiChevronsLeft size={20} />
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="roles-table-pagination-icon"
                type="button"
              >
                <BiChevronLeft size={20} />
              </button>

              <span className="roles-table-pagination-page-info">
                Страница {pagination.pageIndex + 1} из {totalPages || 1}
              </span>

              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="roles-table-pagination-icon"
                type="button"
              >
                <BiChevronRight size={20} />
              </button>
              <button
                onClick={() => table.setPageIndex(totalPages - 1)}
                disabled={!table.getCanNextPage()}
                className="roles-table-pagination-icon"
                type="button"
              >
                <BiChevronsRight size={20} />
              </button>

              <Select
                value={pagination.pageSize}
                onChange={(value: unknown) => {
                  table.setPageSize(value as number);
                }}
                className="roles-table-page-size-select"
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

export default RolesTable;
