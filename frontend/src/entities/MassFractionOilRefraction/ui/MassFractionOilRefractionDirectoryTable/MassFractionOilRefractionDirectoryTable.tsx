import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnSizingState,
} from '@tanstack/react-table';
import { Button } from '@/shared/ui/Button';
import { EditOutlined, DeleteOutlined } from '@/shared/ui/icons';
import { Spin } from '@/shared/ui/Spin';
import './MassFractionOilRefractionDirectoryTable.css';

/** В модалке градуировки — русский разделитель в ячейках. */
function formatRefractionCellForDisplay(v: string): string {
  return String(v).replace(/\./g, ',');
}

interface EntryRow {
  id: string;
  c_value: string;
  n_value: string;
  table_id?: number;
}

interface MassFractionOilRefractionDirectoryTableProps {
  data: EntryRow[];
  loading?: boolean;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
}

const MassFractionOilRefractionDirectoryTable = ({
  data,
  loading = false,
  onEdit,
  onDelete,
}: MassFractionOilRefractionDirectoryTableProps) => {
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const canEdit = Boolean(onEdit && onDelete);

  const columns = React.useMemo<ColumnDef<EntryRow>[]>(
    () => [
      {
        accessorKey: 'c_value',
        header: 'Массовая доля нефти (C), %',
        enableSorting: false,
        size: 300,
        cell: ({ row }) => formatRefractionCellForDisplay(row.original.c_value),
      },
      {
        accessorKey: 'n_value',
        header: 'Показатель преломления (n)',
        enableSorting: false,
        size: 300,
        cell: ({ row }) => formatRefractionCellForDisplay(row.original.n_value),
      },
      ...(canEdit
        ? [
            {
              id: 'actions',
              header: 'Действия',
              enableSorting: false,
              size: 200,
              enableResizing: false,
              cell: ({ row }: { row: { index: number } }) => (
                <div className="mass-fraction-oil-refraction-directory-table-actions">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => onEdit?.(row.index)}
                    className="mass-fraction-oil-refraction-directory-table-edit-button"
                  >
                    Редактировать
                  </Button>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => onDelete?.(row.index)}
                    className="mass-fraction-oil-refraction-directory-table-delete-button"
                  >
                    Удалить
                  </Button>
                </div>
              ),
            } as ColumnDef<EntryRow>,
          ]
        : []),
    ],
    [onEdit, onDelete, canEdit]
  );

  const table = useReactTable<EntryRow>({
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
    <div className="mass-fraction-oil-refraction-directory-table-container">
      {loading ? <Spin size="large" /> : null}
      {!loading && (
        <div className="mass-fraction-oil-refraction-directory-table-wrapper">
          <table className="mass-fraction-oil-refraction-directory-table">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr
                  key={headerGroup.id}
                  className="mass-fraction-oil-refraction-directory-table-header-row"
                >
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      {...{ width: header.getSize() }}
                      className={header.column.getIsResizing() ? 'is-resizing' : ''}
                    >
                      <div className="mass-fraction-oil-refraction-directory-table-header-content">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`mass-fraction-oil-refraction-directory-table-resizer ${
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
                  <td
                    colSpan={columns.length}
                    className="mass-fraction-oil-refraction-directory-table-empty-cell"
                  >
                    Точки градуировочного графика не найдены
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
      )}
    </div>
  );
};

export default MassFractionOilRefractionDirectoryTable;
