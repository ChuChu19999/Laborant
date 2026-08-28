import dayjs from 'dayjs';
import { formatDate } from '@/shared/lib/formatting';
import { Button } from '@/shared/ui/Button';
import { DeleteOutlined, EditOutlined } from '@/shared/ui/icons';
import type { NdNorm } from '../../api';
import type { ResearchMethodDisplayItem } from '@/entities/ResearchMethod/@x/NdNorm';
import type { ColumnDef } from '@tanstack/react-table';
import type { Dayjs } from 'dayjs';

interface CreateNdNormsTableColumnsParams {
  canDelete?: boolean;
  canUpdate?: boolean;
  methods: ResearchMethodDisplayItem[];
  onDelete: (ndNormId: number) => void;
  onEdit: (ndNormId: number) => void;
}

/** Возвращает значение метода в норме НД или прочерк. */
const getMethodValue = (ndNorm: NdNorm, methodId: number): string => {
  const item = ndNorm.method_data?.find(entry => entry.method_id === methodId);
  const value = item?.value?.trim();
  return value || '-';
};

export const createNdNormsTableColumns = ({
  canDelete = true,
  canUpdate = true,
  methods,
  onDelete,
  onEdit,
}: CreateNdNormsTableColumnsParams): ColumnDef<NdNorm>[] => {
  const methodColumns: ColumnDef<NdNorm>[] = methods.map(method => ({
    id: `method_${method.id}`,
    header: method.displayName,
    cell: ({ row }) => (
      <span className="nd-norms-table-method-cell">{getMethodValue(row.original, method.id)}</span>
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
};
