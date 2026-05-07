import dayjs from 'dayjs';
import { formatNumberForDisplay } from './numberFormatting';
import type { Calculation } from '../api/calculation';
import type { ResearchMethod } from '../api/research';
import type { Dayjs } from 'dayjs';

/** Преобразует сохранённый расчёт в значения полей формы CalculationPanel (как «Показать» в админке). */
export function buildCalculationFormPrefill(
  currentMethod: ResearchMethod,
  targetCalculation: Pick<Calculation, 'input_data' | 'laboratory_activity_date' | 'result'>
): {
  initialValues: Record<string, string>;
  laboratoryActivityDate: Dayjs | null;
  waxPrecipitation?: boolean;
} {
  const initialValues: Record<string, string> = {};

  if (
    currentMethod.name === 'Фракционный состав (конденсат)' ||
    currentMethod.name === 'Фракционный состав (нефть)'
  ) {
    const inputData = targetCalculation.input_data as Record<string, unknown>;
    if (inputData._fractional_data) {
      const fractionalData = inputData._fractional_data as {
        card1?: Record<string, unknown>;
        card2?: Record<string, unknown>;
      };

      if (fractionalData.card1) {
        Object.entries(fractionalData.card1).forEach(([fieldName, value]) => {
          const formFieldName = `${currentMethod.id}_${fieldName}`;
          initialValues[formFieldName] =
            value && (typeof value === 'string' || typeof value === 'number')
              ? formatNumberForDisplay(value)
              : '';
        });
      }

      if (fractionalData.card2) {
        Object.entries(fractionalData.card2).forEach(([fieldName, value]) => {
          const formFieldName = `${currentMethod.id}_${fieldName}_card_2`;
          initialValues[formFieldName] =
            value && (typeof value === 'string' || typeof value === 'number')
              ? formatNumberForDisplay(value)
              : '';
        });
      }
    } else {
      Object.entries(targetCalculation.input_data).forEach(([fieldName, value]) => {
        const field = currentMethod.input_data.fields.find(f => f.name === fieldName);
        const cardIndex = field?.card_index || 1;

        const formFieldName =
          cardIndex > 1
            ? `${currentMethod.id}_${fieldName}_card_${cardIndex}`
            : `${currentMethod.id}_${fieldName}`;

        initialValues[formFieldName] =
          value && (typeof value === 'string' || typeof value === 'number')
            ? formatNumberForDisplay(value)
            : '';
      });
    }
  } else {
    Object.entries(targetCalculation.input_data).forEach(([fieldName, value]) => {
      const field = currentMethod.input_data.fields.find(f => f.name === fieldName);
      const cardIndex = field?.card_index || 1;

      const isColorField = currentMethod.name === 'Массовая доля нефти' && fieldName === 'Цвет';
      const formFieldName = isColorField
        ? `${currentMethod.id}_${fieldName}`
        : cardIndex > 1
          ? `${currentMethod.id}_${fieldName}_card_${cardIndex}`
          : `${currentMethod.id}_${fieldName}`;

      initialValues[formFieldName] =
        value && (typeof value === 'string' || typeof value === 'number')
          ? formatNumberForDisplay(value)
          : '';
    });
  }

  let laboratoryActivityDate: Dayjs | null = null;
  if (targetCalculation.laboratory_activity_date) {
    const date = dayjs(targetCalculation.laboratory_activity_date);
    if (date.isValid()) {
      laboratoryActivityDate = date;
    }
  }

  const waxPrecipitation =
    currentMethod.name === 'При 20 ℃' && targetCalculation.result === 'выпадение парафина';

  return {
    initialValues,
    laboratoryActivityDate,
    ...(waxPrecipitation ? { waxPrecipitation: true } : {}),
  };
}

/** Одна запись списка методов для CalculationsPage при редактировании существующего расчёта. */
export function buildAvailableMethodsFromResearchMethod(method: ResearchMethod): Array<{
  id: number | string;
  name: string;
  is_group?: boolean;
  group_id?: number;
  methods?: Array<{
    id: number;
    name: string;
    input_data?: ResearchMethod['input_data'];
    intermediate_data?: ResearchMethod['intermediate_data'];
    unit?: string;
    equipment_data_default?: number[];
    sort_order?: number;
  }>;
  input_data?: ResearchMethod['input_data'];
  intermediate_data?: ResearchMethod['intermediate_data'];
  unit?: string;
  equipment_data_default?: number[];
  sort_order?: number;
}> {
  if (method.is_group_member && method.groups && method.groups.length > 0) {
    const g = method.groups[0];
    return [
      {
        id: `group-${g.id}`,
        name: g.name,
        is_group: true,
        group_id: g.id,
        methods: [
          {
            id: method.id,
            name: method.name,
            input_data: method.input_data,
            intermediate_data: method.intermediate_data,
            unit: method.unit,
            equipment_data_default: method.equipment_data_default,
            sort_order: method.sort_order,
          },
        ],
        sort_order: method.sort_order,
      },
    ];
  }

  return [
    {
      id: method.id,
      name: method.name,
      is_group: false,
      input_data: method.input_data,
      intermediate_data: method.intermediate_data,
      unit: method.unit,
      equipment_data_default: method.equipment_data_default,
      sort_order: method.sort_order,
    },
  ];
}
