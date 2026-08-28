import React, { useMemo } from 'react';
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { useEmployeesByHsnils } from '@/entities/Employee/@x/Calculation';
import { Spin } from '@/shared/ui/Spin';
import { useCalculationMethodsLookup } from '../../model/useCalculationTableLookups';
import { createCalculationsTableColumns } from './calculationsTableColumns';
import type { Calculation } from '../../api';
import './CalculationsTable.css';

interface CalculationsTableProps {
  data: Calculation[];
  loading?: boolean;
  /** Режим модалки: таблица на всю ширину с переносом ячеек. */
  variant?: 'default' | 'modal';
  onDelete?: (calculationId: number) => void;
  onEdit?: (calculation: Calculation) => void;
}

const CalculationsTable = ({
  data,
  loading = false,
  variant = 'default',
  onDelete,
  onEdit,
}: CalculationsTableProps) => {
  const uniqueExecutors = useMemo(
    () => Array.from(new Set(data.filter(calc => calc.executor).map(calc => calc.executor))),
    [data]
  );

  const uniqueMethodIds = useMemo(
    () =>
      Array.from(
        new Set(
          data
            .map(calc => calc.research_method_id)
            .filter((id): id is number => typeof id === 'number')
        )
      ),
    [data]
  );

  const { data: employeesMap = {} } = useEmployeesByHsnils(uniqueExecutors, data.length > 0);
  const { methodsById, methodDisplayNames, methodSortOrders } = useCalculationMethodsLookup(
    uniqueMethodIds,
    data.length > 0
  );

  const sortedData = React.useMemo<Calculation[]>(() => {
    if (data.length === 0) return data;

    return [...data].sort((a, b) => {
      const aId = a.research_method_id;
      const bId = b.research_method_id;

      const aOrder =
        typeof aId === 'number' && aId in methodSortOrders
          ? (methodSortOrders[aId] ?? Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY;
      const bOrder =
        typeof bId === 'number' && bId in methodSortOrders
          ? (methodSortOrders[bId] ?? Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      const aName =
        (typeof aId === 'number' && methodDisplayNames[aId]) || a.research_method?.name || '';
      const bName =
        (typeof bId === 'number' && methodDisplayNames[bId]) || b.research_method?.name || '';

      return aName.localeCompare(bName, 'ru');
    });
  }, [data, methodSortOrders, methodDisplayNames]);

  const columns = React.useMemo(
    () =>
      createCalculationsTableColumns({
        employeesMap,
        methodDisplayNames,
        methodsById,
        onDelete,
        onEdit,
      }),
    [employeesMap, methodDisplayNames, methodsById, onDelete, onEdit]
  );

  const table = useReactTable<Calculation>({
    data: sortedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: false,
  });

  const containerClassName =
    variant === 'modal'
      ? [
          'calculations-table-container',
          'calculations-table-container--modal',
          loading ? 'calculations-table-container--loading' : '',
        ]
          .filter(Boolean)
          .join(' ')
      : 'calculations-table-container';

  return (
    <div className={containerClassName}>
      {loading ? <Spin size="large" /> : null}
      {!loading && (
        <div className="calculations-table-wrapper">
          <table className="calculations-table">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="calculations-table-header-row">
                  {headerGroup.headers.map(header => (
                    <th key={header.id} {...{ width: header.getSize() }}>
                      <div className="calculations-table-header-content">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="calculations-table-empty-cell">
                    Расчёты не найдены
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} width={cell.column.getSize()}>
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

export default CalculationsTable;
