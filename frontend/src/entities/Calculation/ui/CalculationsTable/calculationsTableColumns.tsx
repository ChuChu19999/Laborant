import { getChlorideSaltsResultDisplay } from '@/entities/ResearchMethod/@x/Calculation';
import { formatDate } from '@/shared/lib/formatting';
import { Button } from '@/shared/ui/Button';
import { DeleteOutlined, EditOutlined } from '@/shared/ui/icons';
import {
  formatFractionalError,
  formatFractionalResult,
  formatInputData,
  formatNumberWithMinus,
} from './tableUtils';
import type { Calculation } from '../../api';
import type { ResearchMethod } from '@/entities/ResearchMethod/@x/Calculation';
import type { ColumnDef } from '@tanstack/react-table';

interface CreateCalculationsTableColumnsParams {
  employeesMap: Record<string, { fullName?: string }>;
  methodDisplayNames: Record<number, string>;
  methodsById: Record<number, ResearchMethod>;
  onDelete?: (calculationId: number) => void;
  onEdit?: (calculation: Calculation) => void;
}

export const createCalculationsTableColumns = ({
  employeesMap,
  methodDisplayNames,
  methodsById,
  onDelete,
  onEdit,
}: CreateCalculationsTableColumnsParams): ColumnDef<Calculation>[] => [
  {
    accessorKey: 'research_method',
    header: 'Метод исследования',
    cell: ({ row }) => {
      const method = row.original.research_method;
      const methodId = row.original.research_method_id;

      if (typeof methodId === 'number' && methodDisplayNames[methodId]) {
        return methodDisplayNames[methodId];
      }

      return method?.name || '-';
    },
    enableSorting: false,
    size: 140,
  },
  {
    accessorKey: 'input_data',
    header: 'Входные данные',
    cell: ({ row }) =>
      formatInputData(
        row.original.input_data,
        row.original.research_method?.name,
        typeof row.original.research_method_id === 'number'
          ? methodsById[row.original.research_method_id]
          : undefined
      ),
    enableSorting: false,
    size: 200,
  },
  {
    accessorKey: 'result',
    header: 'Результат',
    cell: ({ row }) => {
      const result = row.original.result || '-';
      if (result === '-') return result;

      const methodName = row.original.research_method?.name || '';
      const isFractional = methodName.includes('Фракционный состав');

      if (isFractional) {
        return formatFractionalResult(result.toString(), methodName);
      }

      const chlorideDisplay = getChlorideSaltsResultDisplay(row.original.input_data);
      if (chlorideDisplay) {
        return chlorideDisplay;
      }

      const formatted = result.toString().replace(/\./g, ',');
      return formatNumberWithMinus(formatted);
    },
    enableSorting: false,
    size: 200,
  },
  {
    accessorKey: 'measurement_error',
    header: 'Погр.',
    cell: ({ row }) => {
      const error = row.original.measurement_error;
      const methodName = row.original.research_method?.name;
      const result = row.original.result;
      return formatFractionalError(error, methodName, result || null);
    },
    enableSorting: false,
    size: 65,
  },
  {
    accessorKey: 'unit',
    header: 'Ед. изм.',
    cell: ({ row }) => {
      const unit = row.original.unit;
      const methodName = row.original.research_method?.name;
      const result = row.original.result;
      const methodId = row.original.research_method_id;

      const isFractionalComposition =
        methodName && methodName.toLowerCase().includes('фракционный состав');

      if (isFractionalComposition && result && typeof methodId === 'number') {
        const method = methodsById[methodId];
        if (!method) {
          return unit || '-';
        }

        try {
          const parsed: unknown = typeof result === 'string' ? JSON.parse(result) : result;
          if (!parsed || typeof parsed !== 'object') {
            return unit || method.unit || '-';
          }

          const entries = Object.entries(parsed as Record<string, unknown>);
          if (entries.length === 0) {
            return unit || method.unit || '-';
          }

          const inputFields = method.input_data?.fields || [];

          const getUnitForKey = (key: string): string => {
            const directField = inputFields.find(f => f.name === key && f.unit);
            if (directField?.unit) {
              return directField.unit;
            }

            const parts = key.split(' ');
            if (parts.length >= 2) {
              const tailName = parts.slice(-2).join(' ');
              const tailField = inputFields.find(f => f.name === tailName && f.unit);
              if (tailField?.unit) {
                return tailField.unit;
              }
            }

            return unit || method.unit || '-';
          };

          const unitValues = entries
            .map(([key, value]) => {
              const correctedKey = key.replace(/н,к\./g, 'н.к.');
              if (value === null || value === undefined || value === '-') {
                return null;
              }
              return { key: correctedKey, unit: getUnitForKey(correctedKey) };
            })
            .filter((item): item is { key: string; unit: string } => item !== null);

          if (unitValues.length === 0) {
            return unit || method.unit || '-';
          }

          return (
            <div className="calculations-table-fractional-error-container">
              {unitValues.map(item => (
                <div key={item.key} className="calculations-table-fractional-error-item">
                  {item.unit}
                </div>
              ))}
            </div>
          );
        } catch {
          return unit || method.unit || '-';
        }
      }

      return unit || '-';
    },
    enableSorting: false,
    size: 35,
  },
  {
    accessorKey: 'equipment',
    header: 'Приборы',
    cell: ({ row }) => {
      const equipment = row.original.equipment;
      if (!equipment || equipment.length === 0) return '-';
      return (
        <div className="calculations-table-equipment-container">
          {equipment.map(eq => (
            <div key={eq.id} className="calculations-table-equipment-item">
              <span>{eq.name}</span>
              {eq.serial_number && (
                <span className="calculations-table-equipment-serial">
                  {' '}
                  (Зав. №{eq.serial_number})
                </span>
              )}
            </div>
          ))}
        </div>
      );
    },
    enableSorting: false,
    size: 140,
  },
  {
    accessorKey: 'executor',
    header: 'Исполнитель',
    cell: ({ row }) => {
      const executorHash = row.original.executor;
      if (!executorHash) return '-';
      const employee = employeesMap[executorHash];
      return employee?.fullName || executorHash;
    },
    enableSorting: false,
    size: 100,
  },
  {
    accessorKey: 'laboratory_activity_date',
    header: 'Дата лаб. деят.',
    cell: ({ row }) => formatDate(row.original.laboratory_activity_date),
    enableSorting: false,
    size: 80,
  },
  {
    id: 'actions',
    header: 'Действия',
    cell: ({ row }) => (
      <div className="calculations-table-actions">
        {onEdit && (
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(row.original)}
            className="calculations-table-edit-button"
          >
            Редактировать
          </Button>
        )}
        {onDelete && (
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => onDelete(row.original.id)}
            className="calculations-table-delete-button"
          >
            Удалить
          </Button>
        )}
      </div>
    ),
    enableSorting: false,
    size: 120,
  },
];
