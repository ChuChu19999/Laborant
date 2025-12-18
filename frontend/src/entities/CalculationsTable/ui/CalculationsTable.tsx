import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnSizingState,
} from '@tanstack/react-table';
import dayjs from 'dayjs';
import { LoadingCard } from '../../../features/Cards';
import { type Calculation } from '../../../shared/api/calculation';
import './CalculationsTable.css';

interface CalculationsTableProps {
  data: Calculation[];
  loading?: boolean;
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  return dayjs(dateString).format('DD.MM.YYYY');
};

const formatInputData = (inputData: Record<string, unknown>): string => {
  if (!inputData || typeof inputData !== 'object') return '-';

  if (inputData._fractional_data) {
    return 'Фракционный состав';
  }

  const entries = Object.entries(inputData);
  if (entries.length === 0) return '-';

  return entries
    .map(([key, value]) => {
      const formattedValue =
        typeof value === 'number' ? value.toString().replace('.', ',') : String(value);
      return `${key}: ${formattedValue}`;
    })
    .join('; ');
};

const CalculationsTable: React.FC<CalculationsTableProps> = ({ data, loading = false }) => {
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});

  const columns = React.useMemo<ColumnDef<Calculation>[]>(
    () => [
      {
        accessorKey: 'research_method',
        header: 'Метод исследования',
        cell: ({ row }) => {
          const method = row.original.research_method;
          if (method) {
            let methodName = method.name || '-';
            if (methodName.toLowerCase().includes('фракционный состав')) {
              if (methodName.includes('конденсат')) {
                methodName = 'Конденсат';
              } else if (methodName.includes('нефть')) {
                methodName = 'Нефть';
              }
            }
            return methodName;
          }
          return '-';
        },
        enableSorting: false,
        size: 250,
      },
      {
        accessorKey: 'input_data',
        header: 'Входные данные',
        cell: ({ row }) => formatInputData(row.original.input_data),
        enableSorting: false,
        size: 300,
      },
      {
        accessorKey: 'result',
        header: 'Результат',
        cell: ({ row }) => {
          const result = row.original.result || '-';
          return result.toString().replace('.', ',');
        },
        enableSorting: false,
        size: 150,
      },
      {
        accessorKey: 'measurement_error',
        header: 'Погрешность',
        cell: ({ row }) => {
          const error = row.original.measurement_error;
          return error ? error.toString().replace('.', ',') : '-';
        },
        enableSorting: false,
        size: 150,
      },
      {
        accessorKey: 'unit',
        header: 'Единица измерения',
        cell: ({ row }) => row.original.unit || '-',
        enableSorting: false,
        size: 150,
      },
      {
        accessorKey: 'laboratory_activity_date',
        header: 'Дата лабораторной деятельности',
        cell: ({ row }) => formatDate(row.original.laboratory_activity_date),
        enableSorting: false,
        size: 200,
      },
      {
        accessorKey: 'created_at',
        header: 'Дата создания',
        cell: ({ row }) => formatDate(row.original.created_at),
        enableSorting: false,
        size: 150,
        enableResizing: false,
      },
    ],
    []
  );

  const table = useReactTable<Calculation>({
    data,
    columns,
    state: {
      columnSizing,
    },
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  });

  return (
    <div className="calculations-table-container">
      <LoadingCard loading={loading} />
      {!loading && (
        <div className="calculations-table-wrapper">
          <table className="calculations-table">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="calculations-table-header-row">
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize(), position: 'relative' }}
                      className={header.column.getIsResizing() ? 'is-resizing' : ''}
                    >
                      <div className="calculations-table-header-content">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`calculations-table-resizer ${
                            header.column.getIsResizing() ? 'isResizing' : ''
                          }`}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="calculations-table-empty-cell">
                    Расчеты не найдены
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
      )}
    </div>
  );
};

export default CalculationsTable;
