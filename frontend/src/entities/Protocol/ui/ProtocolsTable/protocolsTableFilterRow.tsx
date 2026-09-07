import React from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { getDateRangeFilterValue, getDateRangePresets } from '@/shared/lib/formatting';
import { Input, RangePicker, Select } from '@/shared/ui/FormItems';
import { TableFilterCell, TableFilterTheme, tableFilterSelectProps } from '@/shared/ui/TableFilter';
import type { Protocol } from '../../api';
import type { Header } from '@tanstack/react-table';
dayjs.extend(customParseFormat);

const DATE_FILTER_COLUMN_IDS = new Set(['test_protocol_date', 'created_at']);

interface ProtocolsTableFilterRowProps {
  applyFilters: () => void;
  headers: Header<Protocol, unknown>[];
}

export function ProtocolsTableFilterRow({ applyFilters, headers }: ProtocolsTableFilterRowProps) {
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
              ) : header.column.getCanFilter() && header.column.id === 'is_accredited' ? (
                <Select
                  value={header.column.getFilterValue() ?? undefined}
                  onChange={(value: unknown) => {
                    header.column.setFilterValue(
                      value === undefined || value === null ? null : value
                    );
                    setTimeout(() => {
                      applyFilters();
                    }, 0);
                  }}
                  {...tableFilterSelectProps(selectPopup)}
                  placeholder="Выберите"
                  className="table-filter-select"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  options={[
                    { label: 'Да', value: true },
                    { label: 'Нет', value: false },
                  ]}
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
