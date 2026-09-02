import {
  normalizeFractionalKey,
  roundValueForCondensateFractional,
  roundValueForOilFractional,
} from '@/entities/ResearchMethod/@x/Calculation';
import { toDisplayString } from '@/shared/lib/formatting';
import type { ResearchMethod } from '@/entities/ResearchMethod/@x/Calculation';
import type { ReactNode } from 'react';

/** Заменяет ведущий минус в строке числа на слово «минус». */
export const formatNumberWithMinus = (value: string): string => {
  return value.replace(/^-/, 'минус ');
};

/** Форматирует входные данные расчёта для ячейки таблицы. */
export const formatInputData = (
  inputData: Record<string, unknown>,
  methodName?: string,
  method?: ResearchMethod
): ReactNode => {
  if (!inputData || typeof inputData !== 'object') return '-';

  const unitByName: Record<string, string> =
    method?.input_data?.fields?.reduce<Record<string, string>>((acc, field) => {
      if (field.name && field.unit) {
        acc[field.name] = field.unit;
      }
      return acc;
    }, {}) || {};

  const isFractionalComposition =
    methodName && methodName.toLowerCase().includes('фракционный состав');

  if (isFractionalComposition && inputData._fractional_data) {
    try {
      const fractionalData = inputData._fractional_data as {
        card1?: Record<string, unknown>;
        card2?: Record<string, unknown>;
      };
      const formattedCards: ReactNode[] = [];

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
                const numValue = parseFloat(toDisplayString(value).replace(',', '.'));
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
                formattedValue = toDisplayString(value);
              }

              return (
                <div key={field} className="calculations-table-fractional-input-item">
                  {field} = {formattedValue}
                  {unitByName[field] ? ` ${unitByName[field]}` : ''}
                </div>
              );
            })}
          </div>
        );
      });

      if (formattedCards.length === 0) return 'Фракционный состав';

      const cardsWithSpacing: ReactNode[] = [];
      formattedCards.forEach((card, index) => {
        cardsWithSpacing.push(card);
        if (index < formattedCards.length - 1) {
          cardsWithSpacing.push(
            <div key={`spacer-${index}`} className="calculations-table-card-spacer" />
          );
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

  const entries = Object.entries(inputData).filter(([key]) => !key.startsWith('_'));
  if (entries.length === 0) return '-';

  return (
    <div className="calculations-table-input-data-container">
      {entries.map(([key, value]) => {
        let formattedValue: string;
        if (typeof value === 'number') {
          formattedValue = value.toString().replace(/\./g, ',');
        } else {
          const strValue = toDisplayString(value);
          formattedValue = strValue.replace(/(-?\d+)\.(\d+)/g, '$1,$2');
        }
        formattedValue = formatNumberWithMinus(formattedValue);
        return (
          <div key={key} className="calculations-table-input-data-item">
            {key} = {formattedValue}
            {unitByName[key] ? ` ${unitByName[key]}` : ''}
          </div>
        );
      })}
    </div>
  );
};

/** Форматирует результат фракционного состава для ячейки таблицы. */
export const formatFractionalResult = (result: string, methodName?: string): ReactNode => {
  if (!result || result === '-') return '-';

  try {
    const parsed: unknown = JSON.parse(result);
    if (typeof parsed !== 'object' || parsed === null) {
      const formatted = result.toString().replace(/\./g, ',');
      return formatNumberWithMinus(formatted);
    }

    const correctedParsed: Record<string, unknown> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      const correctedKey = normalizeFractionalKey(key);
      correctedParsed[correctedKey] = value;
    });

    const entries = Object.entries(correctedParsed);
    if (entries.length === 0) return '-';

    const isCondensate = methodName === 'Фракционный состав (конденсат)';
    const isOil = methodName === 'Фракционный состав (нефть)';

    return (
      <div className="calculations-table-fractional-result-container">
        {entries.map(([key, value]) => {
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
            const strValue = toDisplayString(value);
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
          formattedValue = formatNumberWithMinus(formattedValue);
          return (
            <div key={key} className="calculations-table-fractional-result-item">
              {key} = {formattedValue}
            </div>
          );
        })}
      </div>
    );
  } catch {
    const formatted = result.toString().replace(/\./g, ',');
    return formatNumberWithMinus(formatted);
  }
};

/** Возвращает погрешность для температуры к.к. конденсата. */
export const getCondensateKkMeasurementError = (rawValue: unknown): string => {
  const strVal = toDisplayString(rawValue).trim().toLowerCase();
  if (strVal === 'выше 360') {
    return '-';
  }
  const num = parseFloat(toDisplayString(rawValue).replace(',', '.'));
  if (!isNaN(num) && num > 360) {
    return '-';
  }
  return '±7';
};

/** Форматирует погрешность измерения, включая фракционный состав. */
export const formatFractionalError = (
  measurementError: string | null | undefined,
  methodName: string | undefined,
  result: string | null | undefined
): ReactNode => {
  const isFractionalComposition =
    methodName && methodName.toLowerCase().includes('фракционный состав');

  if (isFractionalComposition && result) {
    const isCondensate = methodName === 'Фракционный состав (конденсат)';
    const isOil = methodName === 'Фракционный состав (нефть)';

    if (isCondensate || isOil) {
      try {
        const parsedResult: unknown = typeof result === 'string' ? JSON.parse(result) : result;
        if (parsedResult && typeof parsedResult === 'object') {
          const resultRecord = parsedResult as Record<string, unknown>;
          const errorMap: Record<string, string> = {};

          if (isCondensate) {
            Object.keys(resultRecord).forEach(key => {
              const correctedKey = normalizeFractionalKey(key);
              if (correctedKey === 'Температура н.к.') {
                errorMap[correctedKey] = '±5';
              } else if (correctedKey === '10% отгона при температуре') {
                errorMap[correctedKey] = '±4';
              } else if (correctedKey === '50% отгона при температуре') {
                errorMap[correctedKey] = '±2';
              } else if (correctedKey === '90% отгона при температуре') {
                errorMap[correctedKey] = '±5';
              } else if (correctedKey === 'Объёмная доля остатка') {
                errorMap[correctedKey] = '±0,3';
              } else if (correctedKey === 'Температура к.к.') {
                errorMap[correctedKey] = getCondensateKkMeasurementError(resultRecord[key]);
              } else {
                errorMap[correctedKey] = '-';
              }
            });
          } else if (isOil) {
            Object.keys(resultRecord).forEach(key => {
              const correctedKey = normalizeFractionalKey(key);
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

          const errorValues = Object.entries(resultRecord)
            .map(([key, value]) => {
              const correctedKey = normalizeFractionalKey(key);
              if (value !== null && value !== undefined && value !== '-') {
                return { key: correctedKey, error: errorMap[correctedKey] || '-' };
              }
              return null;
            })
            .filter((item): item is { key: string; error: string } => item !== null);

          if (errorValues.length === 0) return '-';

          return (
            <div className="calculations-table-fractional-error-container">
              {errorValues.map(item => (
                <div key={item.key} className="calculations-table-fractional-error-item">
                  {item.error}
                </div>
              ))}
            </div>
          );
        }
      } catch {
        if (measurementError && measurementError !== '-') {
          return `±${measurementError}`;
        }
        return '-';
      }
    }
  }

  if (!measurementError || measurementError === '-') return '-';
  let formattedError = measurementError.toString().replace(/\./g, ',');
  formattedError = formatNumberWithMinus(formattedError);
  return formattedError.startsWith('±') ||
    formattedError.startsWith('+') ||
    formattedError.startsWith('минус')
    ? formattedError
    : `± ${formattedError}`;
};
