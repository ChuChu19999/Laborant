import React from 'react';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnSizingState,
} from '@tanstack/react-table';
import { Spin } from 'antd';
import Button from '../../../../shared/ui/Button';
import type { SelectionCondition } from '../../../../shared/api/selectionConditions';
import './SelectionConditionsTable.css';

interface ConditionRow extends SelectionCondition {
  id: string;
}

interface SelectionConditionsTableProps {
  data: ConditionRow[];
  loading?: boolean;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}

const SelectionConditionsTable: React.FC<SelectionConditionsTableProps> = ({
  data,
  loading = false,
  onEdit,
  onDelete,
}) => {
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});

  const columns = React.useMemo<ColumnDef<ConditionRow>[]>(
    () => [
      {
        accessorKey: 'variable',
        header: 'Переменная',
        enableSorting: false,
        size: 300,
      },
      {
        accessorKey: 'unit',
        header: 'Единица измерения',
        enableSorting: false,
        size: 300,
      },
      {
        id: 'actions',
        header: 'Действия',
        enableSorting: false,
        size: 200,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="selection-conditions-table-actions">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(row.index)}
              className="selection-conditions-table-edit-button"
            >
              Редактировать
            </Button>
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => onDelete(row.index)}
              className="selection-conditions-table-delete-button"
            >
              Удалить
            </Button>
          </div>
        ),
      },
    ],
    [onEdit, onDelete]
  );

  const table = useReactTable<ConditionRow>({
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
    <div className="selection-conditions-table-container">
      {loading ? <Spin size="large" /> : null}
      {!loading && (
        <div className="selection-conditions-table-wrapper">
          <table className="selection-conditions-table">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="selection-conditions-table-header-row">
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize(), position: 'relative' }}
                      className={header.column.getIsResizing() ? 'is-resizing' : ''}
                    >
                      <div className="selection-conditions-table-header-content">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`selection-conditions-table-resizer ${
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
                  <td colSpan={columns.length} className="selection-conditions-table-empty-cell">
                    Условия отбора не найдены
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

export default SelectionConditionsTable;
