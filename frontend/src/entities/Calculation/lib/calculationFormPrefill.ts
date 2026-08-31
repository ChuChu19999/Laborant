import dayjs from 'dayjs';
import { isMassFractionOilResearchMethod } from '@/entities/ResearchMethod/@x/Calculation';
import { formatNumberForDisplay } from '@/shared/lib/formatting';
import type { Calculation } from '../api/calculation';
import type { ResearchMethod } from '@/entities/ResearchMethod/@x/Calculation';
import type { Dayjs } from 'dayjs';

function getCalculationFormFieldName(
  methodId: number,
  field: { name: string; card_index?: number }
): string {
  return field.card_index && field.card_index > 1
    ? `${methodId}_${field.name}_card_${field.card_index}`
    : `${methodId}_${field.name}`;
}

/** Преобразует сохраненный расчёт в значения полей формы CalculationPanel. */
export function buildCalculationFormPrefill(
  currentMethod: ResearchMethod,
  targetCalculation: Pick<Calculation, 'input_data' | 'laboratory_activity_date' | 'result'>
): {
  initialValues: Record<string, string>;
  laboratoryActivityDate: Dayjs | null;
  waxPrecipitation?: boolean;
  /** Числовые C₁/C₂ для повторной отправки на расчёт (точка как разделитель). */
  massFractionOilNumericC?: Record<string, string>;
} {
  const initialValues: Record<string, string> = {};
  const massFractionOilNumericC: Record<string, string> = {};

  if (
    currentMethod.name === 'Фракционный состав (конденсат)' ||
    currentMethod.name === 'Фракционный состав (нефть)'
  ) {
    const inputData = targetCalculation.input_data;
    if (inputData._fractional_data) {
      const fractionalData = inputData._fractional_data as {
        card1?: Record<string, unknown>;
        card2?: Record<string, unknown>;
      };

      if (fractionalData.card1) {
        Object.entries(fractionalData.card1).forEach(([fieldName, value]) => {
          const formFieldName = getCalculationFormFieldName(currentMethod.id, {
            name: fieldName,
            card_index: 1,
          });
          initialValues[formFieldName] =
            value && (typeof value === 'string' || typeof value === 'number')
              ? formatNumberForDisplay(value)
              : '';
        });
      }

      if (fractionalData.card2) {
        Object.entries(fractionalData.card2).forEach(([fieldName, value]) => {
          const formFieldName = getCalculationFormFieldName(currentMethod.id, {
            name: fieldName,
            card_index: 2,
          });
          initialValues[formFieldName] =
            value && (typeof value === 'string' || typeof value === 'number')
              ? formatNumberForDisplay(value)
              : '';
        });
      }
    }
  } else {
    const inputData = targetCalculation.input_data || {};
    for (const field of currentMethod.input_data.fields) {
      if (!(field.name in inputData)) {
        continue;
      }
      const value = inputData[field.name];
      const formFieldName = getCalculationFormFieldName(currentMethod.id, field);
      const isColorField = isMassFractionOilResearchMethod(currentMethod) && field.name === 'Цвет';
      if (isColorField) {
        initialValues[formFieldName] =
          value !== null &&
          value !== undefined &&
          (typeof value === 'string' || typeof value === 'number')
            ? String(value)
            : '';
        continue;
      }

      if (
        isMassFractionOilResearchMethod(currentMethod) &&
        (field.name === 'C₁' || field.name === 'C1' || field.name === 'C₂' || field.name === 'C2')
      ) {
        const rawStr =
          value !== null && value !== undefined
            ? typeof value === 'string' || typeof value === 'number'
              ? String(value)
              : ''
            : '';
        if (rawStr) {
          massFractionOilNumericC[formFieldName] = rawStr.replace(',', '.');
        }
      }

      initialValues[formFieldName] =
        value !== null &&
        value !== undefined &&
        (typeof value === 'string' || typeof value === 'number')
          ? formatNumberForDisplay(value)
          : '';
    }
  }

  let laboratoryActivityDate: Dayjs | null = null;
  if (targetCalculation.laboratory_activity_date) {
    const parsed = dayjs(targetCalculation.laboratory_activity_date);
    laboratoryActivityDate = parsed.isValid() ? parsed : null;
  }

  const waxPrecipitation = Boolean(targetCalculation.input_data?._wax_precipitation);

  const out: {
    initialValues: Record<string, string>;
    laboratoryActivityDate: Dayjs | null;
    waxPrecipitation?: boolean;
    massFractionOilNumericC?: Record<string, string>;
  } = {
    initialValues,
    laboratoryActivityDate,
    ...(waxPrecipitation ? { waxPrecipitation: true } : {}),
  };
  if (Object.keys(massFractionOilNumericC).length > 0) {
    out.massFractionOilNumericC = massFractionOilNumericC;
  }
  return out;
}

/** Одна запись списка методов для CalculationsPage при редактировании существующего расчёта. */
export function buildAvailableMethodsFromResearchMethod(method: ResearchMethod): {
  id: number | string;
  name: string;
  is_group?: boolean;
  group_id?: number;
  methods?: {
    id: number;
    name: string;
    input_data?: ResearchMethod['input_data'];
    intermediate_data?: ResearchMethod['intermediate_data'];
    unit?: string;
    equipment_data_default?: number[];
    sort_order?: number;
  }[];
  input_data?: ResearchMethod['input_data'];
  intermediate_data?: ResearchMethod['intermediate_data'];
  unit?: string;
  equipment_data_default?: number[];
  sort_order?: number;
}[] {
  if (method.is_group_member && method.groups && method.groups.length > 0) {
    const g = method.groups[0];
    if (!g) {
      return [];
    }
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
