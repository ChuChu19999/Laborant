import { formatDate } from '@/shared/lib/formatting';
import { Button } from '@/shared/ui/Button';
import { DeleteOutlined, EditOutlined } from '@/shared/ui/icons';
import { dateRangeFilterFn, formatEquipmentType } from './tableUtils';
import type { Equipment } from '../../api';
import type { ColumnDef } from '@tanstack/react-table';

interface CreateEquipmentTableColumnsParams {
  canDelete?: boolean;
  canUpdate?: boolean;
  onDelete: (equipmentId: number) => void;
  onEdit: (equipmentId: number) => void;
}

export const createEquipmentTableColumns = ({
  canDelete = true,
  canUpdate = true,
  onDelete,
  onEdit,
}: CreateEquipmentTableColumnsParams): ColumnDef<Equipment>[] => [
  {
    accessorKey: 'type',
    header: 'Тип',
    cell: ({ row }) => formatEquipmentType(row.original.type),
    enableSorting: true,
    enableColumnFilter: true,
    size: 250,
  },
  {
    accessorKey: 'name',
    header: 'Наименование',
    cell: ({ row }) => row.original.name || '-',
    enableSorting: true,
    enableColumnFilter: true,
    size: 300,
  },
  {
    accessorKey: 'serial_number',
    header: 'Заводской номер',
    cell: ({ row }) => row.original.serial_number || '-',
    enableSorting: true,
    enableColumnFilter: true,
    size: 200,
  },
  {
    accessorKey: 'verification_date',
    header: 'Дата поверки',
    cell: ({ row }) => formatDate(row.original.verification_date),
    enableSorting: true,
    enableColumnFilter: true,
    size: 250,
    filterFn: (row, id, filterValue) =>
      dateRangeFilterFn(row, id, filterValue, 'verification_date'),
  },
  {
    accessorKey: 'verification_end_date',
    header: 'Дата окончания поверки',
    cell: ({ row }) => formatDate(row.original.verification_end_date),
    enableSorting: true,
    enableColumnFilter: true,
    size: 250,
    filterFn: (row, id, filterValue) =>
      dateRangeFilterFn(row, id, filterValue, 'verification_end_date'),
  },
  {
    accessorKey: 'created_at',
    header: 'Дата создания',
    cell: ({ row }) => formatDate(row.original.created_at),
    enableSorting: true,
    enableColumnFilter: true,
    size: 250,
    filterFn: (row, id, filterValue) => dateRangeFilterFn(row, id, filterValue, 'created_at'),
  },
  {
    id: 'actions',
    header: 'Действия',
    cell: ({ row }) => (
      <div className="equipment-table-actions">
        {canUpdate && (
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(row.original.id)}
            className="equipment-table-edit-button"
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
            className="equipment-table-delete-button"
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
