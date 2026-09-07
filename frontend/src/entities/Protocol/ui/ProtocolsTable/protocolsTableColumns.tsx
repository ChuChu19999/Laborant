import { formatDate, matchesDateRange } from '@/shared/lib/formatting';
import { Button } from '@/shared/ui/Button';
import { DeleteOutlined, EditOutlined, FileExcelOutlined } from '@/shared/ui/icons';
import type { Protocol } from '../../api';
import type { ColumnDef } from '@tanstack/react-table';

interface CreateProtocolsTableColumnsParams {
  canDelete: boolean;
  canUpdate: boolean;
  generatingProtocols: Set<number>;
  onDelete: (protocolId: number) => void;
  onEdit: (protocolId: number) => void;
  onGenerateExcel?: (protocolId: number) => void | Promise<void>;
  onGenerateExcelClick: (protocolId: number) => void;
}

/** Собирает список регистрационных номеров проб протокола. */
function formatSampleRegistrationNumbers(row: Protocol): string {
  if (!row.samples_data || !Array.isArray(row.samples_data) || row.samples_data.length === 0) {
    return '';
  }
  return row.samples_data.map(sample => sample.registration_number).join(', ');
}

export function createProtocolsTableColumns({
  canDelete,
  canUpdate,
  generatingProtocols,
  onDelete,
  onEdit,
  onGenerateExcel,
  onGenerateExcelClick,
}: CreateProtocolsTableColumnsParams): ColumnDef<Protocol>[] {
  return [
    {
      accessorKey: 'test_protocol_number',
      header: '№ протокола',
      cell: ({ row }) => row.original.formatted_protocol_number || '-',
      enableSorting: true,
      enableColumnFilter: true,
      size: 300,
    },
    {
      accessorKey: 'sampling_act_number',
      header: 'Номер акта отбора',
      cell: ({ row }) => row.original.sampling_act_number || '-',
      enableSorting: true,
      enableColumnFilter: true,
      size: 250,
    },
    {
      id: 'samples_data',
      header: 'Пробы',
      accessorFn: row => formatSampleRegistrationNumbers(row),
      cell: ({ row }) => formatSampleRegistrationNumbers(row.original) || '-',
      enableSorting: true,
      enableColumnFilter: true,
      size: 250,
    },
    {
      accessorKey: 'is_accredited',
      header: 'Аккредитован',
      cell: ({ row }) => (
        <span
          className={
            row.original.is_accredited
              ? 'protocols-table-accredited-check'
              : 'protocols-table-accredited-cross'
          }
        >
          {row.original.is_accredited ? '✓' : '✗'}
        </span>
      ),
      enableSorting: true,
      enableColumnFilter: true,
      size: 220,
    },
    {
      accessorKey: 'created_at',
      header: 'Дата создания',
      cell: ({ row }) => formatDate(row.original.created_at),
      enableSorting: true,
      enableColumnFilter: true,
      size: 250,
      filterFn: (row, _id, filterValue) => matchesDateRange(row.original.created_at, filterValue),
    },
    {
      id: 'actions',
      header: 'Действия',
      cell: ({ row }) => (
        <div className="protocols-table-actions">
          {onGenerateExcel &&
            row.original.protocol_template_id &&
            row.original.has_undeleted_calculations && (
              <Button
                type="text"
                size="small"
                icon={<FileExcelOutlined />}
                onClick={() => onGenerateExcelClick(row.original.id)}
                loading={generatingProtocols.has(row.original.id)}
                className="protocols-table-edit-button"
              >
                Сформировать
              </Button>
            )}
          {canUpdate && (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(row.original.id)}
              className="protocols-table-edit-button"
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
              className="protocols-table-delete-button"
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
}
