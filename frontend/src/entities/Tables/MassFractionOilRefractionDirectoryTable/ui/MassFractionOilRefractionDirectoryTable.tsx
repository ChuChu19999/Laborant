import React from 'react';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnSizingState,
} from '@tanstack/react-table';
import { LoadingCard } from '../../../../features/Cards';
import Button from '../../../../shared/ui/Button/Button';
import './MassFractionOilRefractionDirectoryTable.css';

interface EntryRow {
  id: string;
  c_value: number;
  n_value: number;
  table_id?: number;
}

interface MassFractionOilRefractionDirectoryTableProps {
  data: EntryRow[];
  loading?: boolean;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}

const MassFractionOilRefractionDirectoryTable: React.FC<
  MassFractionOilRefractionDirectoryTableProps
> = ({ data, loading = false, onEdit, onDelete }) => {
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});

  const columns = React.useMemo<ColumnDef<EntryRow>[]>(
    () => [
      {
        accessorKey: 'c_value',
        header: 'Массовая доля нефти (C), %',
        enableSorting: false,
        size: 300,
        cell: ({ row }) => {
          const value = row.original.c_value;
          return value.toFixed(2).replace('.', ',');
        },
      },
      {
        accessorKey: 'n_value',
        header: 'Показатель преломления (n)',
        enableSorting: false,
        size: 300,
        cell: ({ row }) => {
          const value = row.original.n_value;
          return value.toFixed(3).replace('.', ',');
        },
      },
      {
        id: 'actions',
        header: 'Действия',
        enableSorting: false,
        size: 200,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="mass-fraction-oil-refraction-directory-table-actions">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(row.index)}
              className="mass-fraction-oil-refraction-directory-table-edit-button"
            >
              Редактировать
            </Button>
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => onDelete(row.index)}
              className="mass-fraction-oil-refraction-directory-table-delete-button"
            >
              Удалить
            </Button>
          </div>
        ),
      },
    ],
    [onEdit, onDelete]
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
      <LoadingCard loading={loading} />
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
                      style={{ width: header.getSize(), position: 'relative' }}
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
                    Записи справочника не найдены
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

export default MassFractionOilRefractionDirectoryTable;
