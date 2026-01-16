import React, { useEffect, useState } from 'react';
import { DeleteOutlined } from '@ant-design/icons';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import { LoadingCard } from '../../../../features/Cards';
import { type Calculation } from '../../../../shared/api/calculation';
import { employeesApi } from '../../../../shared/api/employees';
import { researchApi, type ResearchMethod } from '../../../../shared/api/research';
import Button from '../../../../shared/ui/Button/Button';
import {
  roundValueForOilFractional,
  roundValueForCondensateFractional,
} from '../../../../shared/utils/calculationUtils';
import { formatDate } from '../../../../shared/utils/dateFormatting';
import './CalculationsTable.css';

interface CalculationsTableProps {
  data: Calculation[];
  loading?: boolean;
  onDelete?: (calculationId: number) => void;
}

// Функция для замены минуса на слово "минус"
const formatNumberWithMinus = (value: string): string => {
  // Заменяем минус в начале числа на слово "минус "
  return value.replace(/^-/, 'минус ');
};

const formatInputData = (
  inputData: Record<string, unknown>,
  methodName?: string
): React.ReactNode => {
  if (!inputData || typeof inputData !== 'object') return '-';

  // Проверяем, является ли это фракционным составом
  const isFractionalComposition =
    methodName && methodName.toLowerCase().includes('фракционный состав');

  if (isFractionalComposition && inputData._fractional_data) {
    try {
      const fractionalData = inputData._fractional_data as {
        card1?: Record<string, unknown>;
        card2?: Record<string, unknown>;
      };
      const formattedCards: React.ReactNode[] = [];

      // Обрабатываем каждую карточку
      Object.entries(fractionalData).forEach(([cardKey, cardData], index) => {
        if (!cardData || typeof cardData !== 'object') return;

        const parallelName =
          cardKey === 'card1'
            ? 'Параллель 1'
            : cardKey === 'card2'
              ? 'Параллель 2'
              : `Параллель ${index + 1}`;

        const isCondensate = methodName === 'Фракционный состав (конденсат)';
        const isOil = methodName === 'Фракционный состав (нефть)';

        formattedCards.push(
          <div key={cardKey} className="calculations-table-fractional-input-card">
            <div className="calculations-table-fractional-input-parallel">{parallelName}:</div>
            {Object.entries(cardData).map(([field, value]) => {
              if (!value || value === '') return null;

              let formattedValue: string;
              if (typeof value === 'number' || !isNaN(Number(value))) {
                const numValue = parseFloat(String(value).replace(',', '.'));
                if (numValue < 0) {
                  const absValue = Math.abs(numValue);
                  if (isOil) {
                    formattedValue = `минус ${roundValueForOilFractional(absValue.toString(), field)}`;
                  } else if (isCondensate) {
                    formattedValue = `минус ${roundValueForCondensateFractional(
                      absValue.toString(),
                      field
                    )}`;
                  } else {
                    formattedValue = `минус ${absValue.toString().replace('.', ',')}`;
                  }
                } else {
                  if (isOil) {
                    formattedValue = roundValueForOilFractional(numValue.toString(), field);
                  } else if (isCondensate) {
                    formattedValue = roundValueForCondensateFractional(numValue.toString(), field);
                  } else {
                    formattedValue = numValue.toString().replace('.', ',');
                  }
                }
              } else {
                formattedValue = String(value);
              }

              return (
                <div key={field} className="calculations-table-fractional-input-item">
                  {field} = {formattedValue}
                </div>
              );
            })}
          </div>
        );
      });

      if (formattedCards.length === 0) return 'Фракционный состав';

      // Добавляем пустые строки между карточками
      const cardsWithSpacing: React.ReactNode[] = [];
      formattedCards.forEach((card, index) => {
        cardsWithSpacing.push(card);
        // Добавляем пустую строку между карточками (но не после последней)
        if (index < formattedCards.length - 1) {
          cardsWithSpacing.push(<div key={`spacer-${index}`} style={{ height: '1em' }} />);
        }
      });

      return (
        <div className="calculations-table-fractional-input-container">{cardsWithSpacing}</div>
      );
    } catch {
      return 'Фракционный состав';
    }
  }

  if (inputData._fractional_data) {
    return 'Фракционный состав';
  }

  const entries = Object.entries(inputData);
  if (entries.length === 0) return '-';

  return (
    <div className="calculations-table-input-data-container">
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
          <div key={index} className="calculations-table-input-data-item">
            {key} = {formattedValue}
          </div>
        );
      })}
    </div>
  );
};

// Функция для форматирования результата фракционного состава
const formatFractionalResult = (result: string, methodName?: string): React.ReactNode => {
  if (!result || result === '-') return '-';

  try {
    // Пытаемся распарсить JSON
    const parsed = JSON.parse(result);
    if (typeof parsed !== 'object' || parsed === null) {
      // Если не объект, возвращаем как есть
      const formatted = result.toString().replace(/\./g, ',');
      return formatNumberWithMinus(formatted);
    }

    // Исправляем "н,к." на "н.к." в ключах
    const correctedParsed: Record<string, unknown> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      const correctedKey = key.replace(/н,к\./g, 'н.к.');
      correctedParsed[correctedKey] = value;
    });

    // Форматируем объект
    const entries = Object.entries(correctedParsed);
    if (entries.length === 0) return '-';

    const isCondensate = methodName === 'Фракционный состав (конденсат)';
    const isOil = methodName === 'Фракционный состав (нефть)';

    return (
      <div className="calculations-table-fractional-result-container">
        {entries.map(([key, value], index) => {
          let formattedValue: string;
          if (typeof value === 'number') {
            const valStr = value.toString();
            if (isOil) {
              formattedValue = roundValueForOilFractional(valStr, key);
            } else if (isCondensate) {
              formattedValue = roundValueForCondensateFractional(valStr, key);
            } else {
              formattedValue = valStr.replace(/\./g, ',');
            }
          } else {
            const strValue = String(value);
            const normalized = strValue.replace(',', '.');
            if (!isNaN(Number(normalized))) {
              if (isOil) {
                formattedValue = roundValueForOilFractional(strValue, key);
              } else if (isCondensate) {
                formattedValue = roundValueForCondensateFractional(strValue, key);
              } else {
                formattedValue = strValue.replace(/(-?\d+)\.(\d+)/g, '$1,$2');
              }
            } else {
              formattedValue = strValue.replace(/(-?\d+)\.(\d+)/g, '$1,$2');
            }
          }
          // Заменяем минус на слово "минус"
          formattedValue = formatNumberWithMinus(formattedValue);
          return (
            <div key={index} className="calculations-table-fractional-result-item">
              {key} = {formattedValue}
            </div>
          );
        })}
      </div>
    );
  } catch {
    // Если не JSON, возвращаем как есть
    const formatted = result.toString().replace(/\./g, ',');
    return formatNumberWithMinus(formatted);
  }
};

// Функция для форматирования погрешности фракционного состава
const formatFractionalError = (
  measurementError: string | null | undefined,
  methodName: string | undefined,
  result: string | null | undefined
): React.ReactNode => {
  const isFractionalComposition =
    methodName && methodName.toLowerCase().includes('фракционный состав');

  // Для фракционного состава всегда показываем погрешности на основе результата
  if (isFractionalComposition && result) {
    const isCondensate = methodName === 'Фракционный состав (конденсат)';
    const isOil = methodName === 'Фракционный состав (нефть)';

    if (isCondensate || isOil) {
      try {
        const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
        if (parsedResult && typeof parsedResult === 'object') {
          const errorMap: Record<string, string> = {};

          if (isCondensate) {
            // Погрешности для конденсата
            Object.keys(parsedResult).forEach(key => {
              const correctedKey = key.replace(/н,к\./g, 'н.к.');
              if (correctedKey === 'Температура н.к.') {
                errorMap[correctedKey] = '±5';
              } else if (correctedKey === '10% отгона при температуре') {
                errorMap[correctedKey] = '±4';
              } else if (correctedKey === '50% отгона при температуре') {
                errorMap[correctedKey] = '±2';
              } else if (correctedKey === '90% отгона при температуре') {
                errorMap[correctedKey] = '±5';
              } else if (correctedKey === 'Объемная доля остатка') {
                errorMap[correctedKey] = '±0,3';
              } else {
                errorMap[correctedKey] = '-';
              }
            });
          } else if (isOil) {
            // Погрешности для нефти
            Object.keys(parsedResult).forEach(key => {
              const correctedKey = key.replace(/н,к\./g, 'н.к.');
              if (correctedKey === 'Температура н.к.') {
                errorMap[correctedKey] = '±5';
              } else if (
                correctedKey.includes('% отгона при температуре') ||
                correctedKey.includes('выход фракций') ||
                correctedKey.includes('Выход фракций')
              ) {
                errorMap[correctedKey] = '±1,4';
              } else {
                errorMap[correctedKey] = '-';
              }
            });
          }

          // Отображаем только погрешности для результатов, которые есть
          const errorValues = Object.entries(parsedResult)
            .map(([key]) => {
              const correctedKey = key.replace(/н,к\./g, 'н.к.');
              const value = parsedResult[key];
              if (value !== null && value !== undefined && value !== '-') {
                return errorMap[correctedKey] || '-';
              }
              return null;
            })
            .filter((error): error is string => error !== null);

          if (errorValues.length === 0) return '-';

          return (
            <div className="calculations-table-fractional-error-container">
              {errorValues.map((error, index) => (
                <div key={index} className="calculations-table-fractional-error-item">
                  {error}
                </div>
              ))}
            </div>
          );
        }
      } catch {
        // Если не удалось распарсить, возвращаем обычное отображение
        if (measurementError && measurementError !== '-') {
          return `±${measurementError}`;
        }
        return '-';
      }
    }
  }

  // Обычное отображение для других методов
  if (!measurementError || measurementError === '-') return '-';
  let formattedError = measurementError.toString().replace(/\./g, ',');
  formattedError = formatNumberWithMinus(formattedError);
  return formattedError.startsWith('±') ||
    formattedError.startsWith('+') ||
    formattedError.startsWith('минус')
    ? formattedError
    : `± ${formattedError}`;
};

const CalculationsTable: React.FC<CalculationsTableProps> = ({
  data,
  loading = false,
  onDelete,
}) => {
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

            // Исключение: фракционный состав всегда показываем как есть, но убираем скобки
            const isFractional = lowerName.includes('фракционный состав');
            if (isFractional) {
              // Убираем текст в скобках для фракционного состава
              const nameWithoutBrackets = baseName.replace(/\s*\([^)]*\)\s*$/, '').trim();
              currentNames[id] = nameWithoutBrackets;
              currentOrders[id] = method.sort_order ?? null;
              return;
            }

            // Если метод состоит в группе — показываем только название группы (кроме "Вязкость кинематическая")
            if (method.is_group_member && method.groups && method.groups.length > 0) {
              const groupName = method.groups[0]?.name || '';
              if (groupName) {
                // Для "Вязкость кинематическая" оставляем скобки, для остальных - только название группы
                if (groupName === 'Вязкость кинематическая') {
                  currentNames[id] = `${groupName} (${baseName.toLowerCase()})`;
                } else {
                  currentNames[id] = groupName;
                }
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
        size: 140,
      },
      {
        accessorKey: 'input_data',
        header: 'Входные данные',
        cell: ({ row }) =>
          formatInputData(row.original.input_data, row.original.research_method?.name),
        enableSorting: false,
        size: 200,
      },
      {
        accessorKey: 'result',
        header: 'Результат',
        cell: ({ row }) => {
          const result = row.original.result || '-';
          if (result === '-') return result;

          // Проверяем, является ли это фракционным составом
          const methodName = row.original.research_method?.name || '';
          const isFractional = methodName.includes('Фракционный состав');

          if (isFractional) {
            return formatFractionalResult(result.toString(), methodName);
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
        cell: ({ row }) => row.original.unit || '-',
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
        size: 95,
      },
    ],
    [employeesMap, methodDisplayNames, onDelete]
  );

  const table = useReactTable<Calculation>({
    data: sortedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: false,
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
                    <th key={header.id} style={{ width: header.getSize() }}>
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
                    Расчеты не найдены
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} style={{ width: cell.column.getSize() }}>
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
