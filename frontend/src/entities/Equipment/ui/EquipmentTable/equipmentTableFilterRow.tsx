import React from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { getDateRangePresets } from '@/shared/lib/formatting';
import { Input, RangePicker } from '@/shared/ui/FormItems';
import { MultiSelectColumnFilter } from '@/shared/ui/MultiSelectColumnFilter';
import {
  TableFilterCell,
  TableFilterTheme,
  tableFilterMultiSelectProps,
} from '@/shared/ui/TableFilter';
import { getDateRangeFilterValue } from './tableUtils';
import type { Equipment } from '../../api';
import type { Header } from '@tanstack/react-table';

dayjs.extend(customParseFormat);

const EQUIPMENT_TYPES = [
  { value: 'measuring_instrument', label: 'Средство измерения' },
  { value: 'test_equipment', label: 'Испытательное оборудование' },
];

const DATE_FILTER_COLUMN_IDS = new Set([
  'verification_date',
  'verification_end_date',
  'created_at',
]);

interface EquipmentTableFilterRowProps {
  applyFilters: () => void;
  applyFiltersWithNewValue: (columnId: string, newValue: string[]) => void;
  headers: Header<Equipment, unknown>[];
}

export function EquipmentTableFilterRow({
  applyFilters,
  applyFiltersWithNewValue,
  headers,
}: EquipmentTableFilterRowProps) {
  return (
    <TableFilterTheme>
      <tr className="table-filter-row">
        {headers.map((header, columnIndex) => (
          <TableFilterCell
            key={`filter-${header.id}`}
            columnIndex={columnIndex}
            columnCount={headers.length}
            className="table-filter-cell"
          >
            {selectPopup =>
              header.column.getCanFilter() && DATE_FILTER_COLUMN_IDS.has(header.column.id) ? (
                <RangePicker
                  value={getDateRangeFilterValue(header.column.getFilterValue())}
                  onChange={(dates: unknown) => {
                    const dateRange = dates as [Dayjs | null, Dayjs | null] | null;
                    header.column.setFilterValue(dateRange);
                    setTimeout(() => {
                      applyFilters();
                    }, 0);
                  }}
                  placeholder={['С', 'По']}
                  className="table-filter-datepicker"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  allowClear
                  presets={getDateRangePresets()}
                />
              ) : header.column.getCanFilter() && header.column.id === 'type' ? (
                <MultiSelectColumnFilter
                  value={(header.column.getFilterValue() as string[]) ?? []}
                  onApply={newValue => {
                    applyFiltersWithNewValue(header.column.id, newValue);
                  }}
                  placeholder="Выберите типы"
                  className="table-filter-select"
                  options={EQUIPMENT_TYPES}
                  {...tableFilterMultiSelectProps(selectPopup)}
                />
              ) : header.column.getCanFilter() ? (
                <Input
                  value={(header.column.getFilterValue() as string) ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    header.column.setFilterValue(e.target.value)
                  }
                  onPressEnter={() => {
                    applyFilters();
                  }}
                  placeholder="Поиск..."
                  className="table-filter-input"
                  onClick={(e: React.MouseEvent<HTMLInputElement>) => e.stopPropagation()}
                  allowClear
                />
              ) : null
            }
          </TableFilterCell>
        ))}
      </tr>
    </TableFilterTheme>
  );
}
