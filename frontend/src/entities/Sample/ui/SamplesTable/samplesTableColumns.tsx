import { formatDate, matchesDateRange, matchesFioSearch } from '@/shared/lib/formatting';
import { Button } from '@/shared/ui/Button';
import { CalculatorOutlined, DeleteOutlined, EditOutlined } from '@/shared/ui/icons';
import { formatWellDisplay } from '../../lib/sampleFormatting';
import type { Sample } from '../../api';
import type { ColumnDef } from '@tanstack/react-table';

interface CreateSamplesTableColumnsParams {
  canDelete: boolean;
  canFillCalculations: boolean;
  canUpdate: boolean;
  employeesMap: Record<string, { fullName?: string }>;
  onDelete: (sampleId: number) => void;
  onEdit: (sampleId: number) => void;
  onFillCalculations?: (sampleId: number) => void;
}

/** Собирает текст места отбора из названия, скважины и режима. */
function formatSamplingLocation(row: Sample): string {
  const parts: string[] = [];
  if (row.sampling_location_name) {
    parts.push(row.sampling_location_name);
  }
  const wellDisplay = formatWellDisplay(row.well);
  if (wellDisplay) {
    parts.push(wellDisplay);
  }
  if (row.mode) {
    parts.push(row.mode);
  }
  return parts.join(' ');
}

/** Собирает список номеров протоколов пробы. */
function formatProtocolNumbers(row: Sample): string {
  if (!row.protocols || !Array.isArray(row.protocols) || row.protocols.length === 0) {
    return '';
  }
  return row.protocols
    .map(protocol => protocol.formatted_protocol_number || '-')
    .filter(formatted => formatted !== '-')
    .join(', ');
}

/** Собирает определения колонок таблицы проб. */
export function createSamplesTableColumns({
  canDelete,
  canFillCalculations,
  canUpdate,
  employeesMap,
  onDelete,
  onEdit,
  onFillCalculations,
}: CreateSamplesTableColumnsParams): ColumnDef<Sample>[] {
  return [
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
      accessorFn: row => formatSamplingLocation(row),
      cell: ({ row }) => formatSamplingLocation(row.original) || '-',
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
      filterFn: (row, _id, filterValue) =>
        matchesDateRange(row.original.sampling_date, filterValue),
    },
    {
      accessorKey: 'receiving_date',
      header: 'Дата получения',
      cell: ({ row }) => formatDate(row.original.receiving_date),
      enableSorting: true,
      enableColumnFilter: true,
      size: 180,
      filterFn: (row, _id, filterValue) =>
        matchesDateRange(row.original.receiving_date, filterValue),
    },
    {
      id: 'protocols',
      header: 'Протоколы',
      accessorFn: row => formatProtocolNumbers(row),
      cell: ({ row }) => formatProtocolNumbers(row.original) || '-',
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
      filterFn: (row, _id, filterValue) => matchesDateRange(row.original.created_at, filterValue),
    },
    {
      accessorKey: 'added_by',
      header: 'Добавил пробу',
      accessorFn: row => {
        const addedBy = row.added_by;
        if (!addedBy) return '';
        return employeesMap[addedBy]?.fullName ?? '';
      },
      cell: ({ row }) => {
        const addedBy = row.original.added_by;
        if (!addedBy) return '-';
        const employee = employeesMap[addedBy];
        return employee?.fullName || '-';
      },
      enableSorting: false,
      enableColumnFilter: true,
      filterFn: (row, _id, filterValue) =>
        matchesFioSearch(
          row.original.added_by ? employeesMap[row.original.added_by]?.fullName : '',
          String(filterValue ?? '')
        ),
      size: 200,
    },
    {
      id: 'actions',
      header: 'Действия',
      cell: ({ row }) => (
        <div className="samples-table-actions">
          {onFillCalculations && canFillCalculations && (
            <Button
              type="text"
              size="small"
              icon={<CalculatorOutlined />}
              onClick={() => onFillCalculations(row.original.id)}
              className="samples-table-edit-button"
            >
              Расчёты
            </Button>
          )}
          {canUpdate && (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(row.original.id)}
              className="samples-table-edit-button"
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
              className="samples-table-delete-button"
            >
              Удалить
            </Button>
          )}
        </div>
      ),
      enableSorting: false,
      enableColumnFilter: false,
      size: 200,
      enableResizing: false,
    },
  ];
}
