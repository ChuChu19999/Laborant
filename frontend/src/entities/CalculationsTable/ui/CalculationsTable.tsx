import React, { useEffect, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnSizingState,
} from '@tanstack/react-table';
import dayjs from 'dayjs';
import { LoadingCard } from '../../../features/Cards';
import { type Calculation } from '../../../shared/api/calculation';
import { employeesApi } from '../../../shared/api/employees';
import { researchApi, type ResearchMethod } from '../../../shared/api/research';
import './CalculationsTable.css';

interface CalculationsTableProps {
  data: Calculation[];
  loading?: boolean;
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  return dayjs(dateString).format('DD.MM.YYYY');
};

// Функция для замены минуса на слово "минус"
const formatNumberWithMinus = (value: string): string => {
  // Заменяем минус в начале числа на слово "минус "
  return value.replace(/^-/, 'минус ');
};

const formatInputData = (inputData: Record<string, unknown>): React.ReactNode => {
  if (!inputData || typeof inputData !== 'object') return '-';

  if (inputData._fractional_data) {
    return 'Фракционный состав';
  }

  const entries = Object.entries(inputData);
  if (entries.length === 0) return '-';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {entries.map(([key, value], index) => {
        let formattedValue: string;
        if (typeof value === 'number') {
          formattedValue = value.toString().replace(/\./g, ',');
        } else {
          const strValue = String(value);
          // Заменяем точку на запятую в числах (включая отрицательные и десятичные)
          formattedValue = strValue.replace(/(-?\d+)\.(\d+)/g, '$1,$2');
        }
        // Заменяем минус на слово "минус"
        formattedValue = formatNumberWithMinus(formattedValue);
        return (
          <div key={index} style={{ lineHeight: '1.4' }}>
            {key} = {formattedValue}
          </div>
        );
      })}
    </div>
  );
};

const CalculationsTable: React.FC<CalculationsTableProps> = ({ data, loading = false }) => {
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const [employeesMap, setEmployeesMap] = useState<Record<string, { fullName: string }>>({});
  const [methodDisplayNames, setMethodDisplayNames] = useState<Record<number, string>>({});
  const [methodSortOrders, setMethodSortOrders] = useState<Record<number, number | null>>({});

  // Загружаем информацию о сотрудниках по массиву executor hashMd5
  useEffect(() => {
    const loadEmployees = async () => {
      const uniqueExecutors = Array.from(
        new Set(data.filter(calc => calc.executor).map(calc => calc.executor))
      );

      if (uniqueExecutors.length === 0) {
        setEmployeesMap({});
        return;
      }

      try {
        const employees = await employeesApi.getByHashes(uniqueExecutors, false);
        setEmployeesMap(employees);
      } catch (error) {
        console.error('Ошибка при загрузке информации о сотрудниках:', error);
        setEmployeesMap({});
      }
    };

    if (data.length > 0) {
      loadEmployees();
    }
  }, [data]);

  // Загружаем методы исследований и формируем отображаемые названия
  useEffect(() => {
    const loadMethods = async () => {
      const uniqueMethodIds = Array.from(
        new Set(
          data
            .map(calc => calc.research_method_id)
            .filter((id): id is number => typeof id === 'number')
        )
      );

      if (uniqueMethodIds.length === 0) {
        setMethodDisplayNames({});
        setMethodSortOrders({});
        return;
      }

      const currentNames: Record<number, string> = {};
      const currentOrders: Record<number, number | null> = {};

      await Promise.all(
        uniqueMethodIds.map(async id => {
          try {
            const method: ResearchMethod = await researchApi.getResearchMethod(id);

            const baseName = method.name || '';
            const lowerName = baseName.toLowerCase();

            // Исключение: фракционный состав всегда показываем как есть
            const isFractional = lowerName.includes('фракционный состав');
            if (isFractional) {
              currentNames[id] = baseName;
              currentOrders[id] = method.sort_order ?? null;
              return;
            }

            // Если метод состоит в группе — показываем "Группа (метод)"
            if (method.is_group_member && method.groups && method.groups.length > 0) {
              const groupName = method.groups[0]?.name || '';
              if (groupName) {
                currentNames[id] = `${groupName} (${baseName.toLowerCase()})`;
                currentOrders[id] = method.sort_order ?? null;
                return;
              }
            }

            // По умолчанию — просто имя метода
            currentNames[id] = baseName;
            currentOrders[id] = method.sort_order ?? null;
          } catch (error) {
            console.error('Ошибка при загрузке метода исследования:', error);
          }
        })
      );

      setMethodDisplayNames(prev => ({ ...prev, ...currentNames }));
      setMethodSortOrders(prev => ({ ...prev, ...currentOrders }));
    };

    if (data.length > 0) {
      void loadMethods();
    } else {
      setMethodDisplayNames({});
    }
  }, [data]);

  // Сортируем расчеты по порядку методов, как в AdminPage/CalculationsPage
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

  const columns = React.useMemo<ColumnDef<Calculation>[]>(
    () => [
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
        size: 250,
      },
      {
        accessorKey: 'input_data',
        header: 'Входные данные',
        cell: ({ row }) => formatInputData(row.original.input_data),
        enableSorting: false,
        size: 350,
      },
      {
        accessorKey: 'result',
        header: 'Результат',
        cell: ({ row }) => {
          const result = row.original.result || '-';
          if (result === '-') return result;
          const formatted = result.toString().replace(/\./g, ',');
          return formatNumberWithMinus(formatted);
        },
        enableSorting: false,
        size: 150,
      },
      {
        accessorKey: 'measurement_error',
        header: 'Погрешность',
        cell: ({ row }) => {
          const error = row.original.measurement_error;
          if (!error) return '-';
          let formattedError = error.toString().replace(/\./g, ',');
          // Заменяем минус на слово "минус"
          formattedError = formatNumberWithMinus(formattedError);
          // Если погрешность уже содержит ±, оставляем как есть, иначе добавляем ±
          return formattedError.startsWith('±') ||
            formattedError.startsWith('+') ||
            formattedError.startsWith('минус')
            ? formattedError
            : `± ${formattedError}`;
        },
        enableSorting: false,
        size: 150,
      },
      {
        accessorKey: 'unit',
        header: 'Единица измерения',
        cell: ({ row }) => row.original.unit || '-',
        enableSorting: false,
        size: 150,
      },
      {
        accessorKey: 'equipment',
        header: 'Приборы',
        cell: ({ row }) => {
          const equipment = row.original.equipment;
          if (!equipment || equipment.length === 0) return '-';
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {equipment.map(eq => (
                <div key={eq.id} style={{ lineHeight: '1.4' }}>
                  <span>{eq.name}</span>
                  {eq.serial_number && (
                    <span style={{ color: '#666' }}> (Зав.№{eq.serial_number})</span>
                  )}
                </div>
              ))}
            </div>
          );
        },
        enableSorting: false,
        size: 200,
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
        size: 200,
      },
      {
        accessorKey: 'laboratory_activity_date',
        header: 'Дата лабораторной деятельности',
        cell: ({ row }) => formatDate(row.original.laboratory_activity_date),
        enableSorting: false,
        size: 200,
        enableResizing: false,
      },
    ],
    [employeesMap, methodDisplayNames]
  );

  const table = useReactTable<Calculation>({
    data: sortedData,
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
    <div className="calculations-table-container">
      <LoadingCard loading={loading} />
      {!loading && (
        <div className="calculations-table-wrapper">
          <table className="calculations-table">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="calculations-table-header-row">
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize(), position: 'relative' }}
                      className={header.column.getIsResizing() ? 'is-resizing' : ''}
                    >
                      <div className="calculations-table-header-content">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`calculations-table-resizer ${
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
                  <td colSpan={columns.length} className="calculations-table-empty-cell">
                    Расчеты не найдены
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

export default CalculationsTable;
