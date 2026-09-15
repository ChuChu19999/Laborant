import React from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { getDateRangeFilterValue, getDateRangePresets } from '@/shared/lib/formatting';
import { Input, RangePicker } from '@/shared/ui/FormItems';
import { MultiSelectColumnFilter } from '@/shared/ui/MultiSelectColumnFilter';
import {
  TableFilterCell,
  TableFilterTheme,
  tableFilterMultiSelectProps,
} from '@/shared/ui/TableFilter';
import type { Sample } from '../../api';
import type { Header } from '@tanstack/react-table';
dayjs.extend(customParseFormat);

const DATE_FILTER_COLUMN_IDS = new Set(['sampling_date', 'receiving_date', 'created_at']);

interface SamplesTableFilterRowProps {
  applyFilters: () => void;
  applyFiltersWithNewValue: (columnId: string, newValue: string[]) => void;
  headers: Header<Sample, unknown>[];
  sampleTypes: string[];
  testObjects: string[];
}

export function SamplesTableFilterRow({
  applyFilters,
  applyFiltersWithNewValue,
  headers,
  sampleTypes,
  testObjects,
}: SamplesTableFilterRowProps) {
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
                  allowEmpty={[true, true]}
                  presets={getDateRangePresets()}
                />
              ) : header.column.getCanFilter() && header.column.id === 'sample_type' ? (
                <MultiSelectColumnFilter
                  value={(header.column.getFilterValue() as string[]) ?? []}
                  onApply={newValue => {
                    applyFiltersWithNewValue(header.column.id, newValue);
                  }}
                  placeholder="Выберите типы"
                  className="table-filter-select"
                  options={sampleTypes.map(type => ({
                    label: type,
                    value: type,
                  }))}
                  {...tableFilterMultiSelectProps(selectPopup)}
                />
              ) : header.column.getCanFilter() && header.column.id === 'test_object' ? (
                <MultiSelectColumnFilter
                  value={(header.column.getFilterValue() as string[]) ?? []}
                  onApply={newValue => {
                    applyFiltersWithNewValue(header.column.id, newValue);
                  }}
                  placeholder="Выберите объекты"
                  className="table-filter-select"
                  showSearch
                  filterOption={(input, option) => {
                    const label: unknown = option?.label;
                    const labelText = typeof label === 'string' ? label : '';
                    return labelText.toLowerCase().includes(input.toLowerCase());
                  }}
                  options={testObjects.map(obj => ({
                    label: obj,
                    value: obj,
                  }))}
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
                  onClear={() => {
                    header.column.setFilterValue('');
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
