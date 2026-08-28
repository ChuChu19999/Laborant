import { createClientKey } from './createClientKey';
import type {
  ConvergenceFormulaForm,
  IntermediateFieldForm,
  MeasurementErrorForm,
  ResearchMethodFormData,
} from './types';
import type {
  FixtureData,
  ResearchMethod,
  ResearchMethodConvergenceConditionsPayload,
  ResearchMethodCreate,
  ResearchMethodIntermediateDataPayload,
  ResearchMethodIntermediateField,
  ResearchMethodMeasurementErrorPayload,
} from '@/entities/ResearchMethod';

function isEmptyRecord(value: unknown): boolean {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

function hasIntermediateFields(
  data: ResearchMethod['intermediate_data'] | FixtureData['intermediate_data'] | undefined
): data is ResearchMethodIntermediateDataPayload {
  return !!data && !isEmptyRecord(data) && 'fields' in data;
}

function hasConvergenceFormulas(
  data: ResearchMethod['convergence_conditions'] | FixtureData['convergence_conditions'] | undefined
): data is ResearchMethodConvergenceConditionsPayload {
  return !!data && !isEmptyRecord(data) && 'formulas' in data && data.formulas.length > 0;
}

/** Маппит промежуточное поле из API в форму. */
export function mapIntermediateFieldFromApi(
  field: ResearchMethodIntermediateField
): IntermediateFieldForm {
  const useMultiple = Boolean(field.use_multiple_rounding);
  const useThreshold = Boolean(field.use_threshold_table);
  const rt = field.rounding_type;
  const hasLegacyCustom =
    !useMultiple &&
    !useThreshold &&
    field.use_result_rounding !== true &&
    (rt === 'decimal' || rt === 'significant') &&
    field.rounding_decimal != null;
  const useResultRounding = hasLegacyCustom ? false : field.use_result_rounding !== false;

  return {
    clientKey: createClientKey(),
    name: field.name ?? '',
    formula: field.formula ?? '',
    description: field.description ?? '',
    unit: field.unit ?? '',
    show_calculation: field.show_calculation ?? true,
    use_multiple_rounding: useMultiple,
    multiple_value: field.multiple_value ?? '',
    use_result_rounding: useResultRounding,
    rounding_type: rt === 'significant' ? 'significant' : 'decimal',
    rounding_decimal: field.rounding_decimal ?? 0,
    range_calculation: field.range_calculation
      ? {
          ranges: (field.range_calculation.ranges ?? []).map(range => ({
            clientKey: createClientKey(),
            condition: range.condition ?? '',
            formula: range.formula ?? '',
          })),
        }
      : undefined,
    use_threshold_table: field.use_threshold_table,
    threshold_table_values: field.threshold_table_values,
  };
}

/** Сериализует промежуточное поле формы для API. */
export function serializeIntermediateFieldForApi(
  field: IntermediateFieldForm
): ResearchMethodIntermediateField {
  const payload: ResearchMethodIntermediateField = {
    name: field.name,
    formula: field.use_threshold_table ? '0' : field.range_calculation ? '0' : field.formula,
    description: field.description,
    unit: field.unit,
    show_calculation: field.show_calculation,
    use_multiple_rounding: field.use_multiple_rounding,
    multiple_value: field.multiple_value,
    range_calculation: field.range_calculation
      ? {
          ranges: field.range_calculation.ranges.map(({ condition, formula }) => ({
            condition,
            formula,
          })),
        }
      : undefined,
    use_threshold_table: field.use_threshold_table,
    threshold_table_values: field.threshold_table_values,
  };

  if (field.use_result_rounding === false && !field.use_multiple_rounding) {
    payload.use_result_rounding = false;
    payload.rounding_type = field.rounding_type === 'significant' ? 'significant' : 'decimal';
    payload.rounding_decimal = field.rounding_decimal ?? 0;
  }

  return payload;
}

/** Извлекает промежуточные поля формы из данных API. */
export function getIntermediateFieldsFromApiData(
  data: ResearchMethod['intermediate_data'] | FixtureData['intermediate_data'] | undefined
): IntermediateFieldForm[] {
  if (!hasIntermediateFields(data)) {
    return [];
  }
  return data.fields.map(field => mapIntermediateFieldFromApi(field));
}

/** Извлекает условия сходимости из данных API. */
export function getConvergenceConditionsFromApiData(
  data: ResearchMethod['convergence_conditions'] | FixtureData['convergence_conditions'] | undefined
): { formulas: ConvergenceFormulaForm[] } {
  if (!hasConvergenceFormulas(data)) {
    return { formulas: [] };
  }
  return {
    formulas: data.formulas.map(formula => ({
      clientKey: createClientKey(),
      formula: formula.formula ?? '',
      convergence_value: formula.convergence_value ?? 'satisfactory',
      custom_value: formula.custom_value,
    })),
  };
}

function isMeasurementErrorPayload(
  value: ResearchMethod['measurement_error']
): value is ResearchMethodMeasurementErrorPayload {
  return !isEmptyRecord(value) && 'type' in value && 'value' in value;
}

/** Разбирает погрешность измерения из API в форму. */
export function parseMeasurementErrorFromApi(
  measurementError: ResearchMethod['measurement_error'] | undefined
): MeasurementErrorForm {
  if (!measurementError || !isMeasurementErrorPayload(measurementError)) {
    return { type: 'none', value: '', ranges: [] };
  }
  const hasRanges = Array.isArray(measurementError.ranges) && measurementError.ranges.length > 0;
  const errorType: 'fixed' | 'formula' | 'range' = hasRanges
    ? 'range'
    : measurementError.type === 'formula'
      ? 'formula'
      : 'fixed';
  return {
    type: errorType,
    value: measurementError.value ?? '',
    ranges: measurementError.ranges ?? [],
  };
}

/** Сериализует погрешность измерения формы для API. */
export function serializeMeasurementErrorForApi(
  measurementError: MeasurementErrorForm
): ResearchMethodCreate['measurement_error'] {
  if (measurementError.type === 'none') {
    return {};
  }
  const payload: ResearchMethodMeasurementErrorPayload = {
    type: measurementError.type === 'range' ? 'fixed' : measurementError.type,
    value: measurementError.value,
  };
  if (measurementError.type === 'range' && measurementError.ranges.length > 0) {
    payload.ranges = measurementError.ranges;
  }
  return payload;
}

/** Сериализует промежуточные данные формы для API. */
export function serializeIntermediateDataForApi(
  fields: IntermediateFieldForm[]
): ResearchMethodCreate['intermediate_data'] {
  if (fields.length === 0) {
    return {};
  }
  return {
    fields: fields.map(serializeIntermediateFieldForApi),
  };
}

/** Сериализует условия сходимости формы для API. */
export function serializeConvergenceConditionsForApi(conditions: {
  formulas: ConvergenceFormulaForm[];
}): NonNullable<ResearchMethodCreate['convergence_conditions']> {
  const formulas = conditions.formulas
    .filter(condition => condition.formula.trim() !== '')
    .map(({ formula, convergence_value, custom_value }) => ({
      formula,
      convergence_value,
      ...(custom_value !== undefined ? { custom_value } : {}),
    }));
  if (formulas.length === 0) {
    return {};
  }
  return { formulas };
}

/** Маппит поля ввода API/fixture в форму с clientKey. */
export function mapInputFieldsFromApi(
  fields:
    | ResearchMethod['input_data']
    | FixtureData['input_data']
    | { fields: { name: string; description: string; unit?: string; card_index: number }[] }
    | undefined
): ResearchMethodFormData['input_data'] {
  const sourceFields =
    fields && 'fields' in fields && Array.isArray(fields.fields) ? fields.fields : null;
  if (!sourceFields || sourceFields.length === 0) {
    return {
      fields: [
        { clientKey: createClientKey(), name: '', description: '', unit: '', card_index: 1 },
      ],
    };
  }
  return {
    fields: sourceFields.map(field => ({
      clientKey: createClientKey(),
      name: field.name ?? '',
      description: field.description ?? '',
      unit: field.unit,
      card_index: field.card_index ?? 1,
    })),
  };
}

/** Преобразует метод исследования в данные формы. */
export function methodToFormData(method: ResearchMethod): ResearchMethodFormData {
  return {
    name: method.name,
    sample_type: Array.isArray(method.sample_type) ? method.sample_type : [],
    formula: method.formula ?? '',
    measurement_error: parseMeasurementErrorFromApi(method.measurement_error),
    unit: method.unit ?? '',
    measurement_method: method.measurement_method ?? '',
    nd_code: method.nd_code ?? '',
    nd_name: method.nd_name ?? '',
    input_data: mapInputFieldsFromApi(method.input_data),
    intermediate_data: {
      fields: getIntermediateFieldsFromApiData(method.intermediate_data),
    },
    convergence_conditions: getConvergenceConditionsFromApiData(method.convergence_conditions),
    rounding_type: method.rounding_type ?? 'decimal',
    rounding_decimal: method.rounding_decimal ?? 0,
  };
}

/** Собирает payload создания метода из данных формы. */
export function buildResearchMethodCreatePayload(
  formData: ResearchMethodFormData,
  catalogTagSet: Set<string>,
  laboratoryId?: number,
  departmentId?: number
): ResearchMethodCreate {
  return {
    name: formData.name,
    sample_type: formData.sample_type.filter(tag => catalogTagSet.has(tag)),
    formula: formData.formula,
    measurement_error: serializeMeasurementErrorForApi(formData.measurement_error),
    unit: formData.unit,
    measurement_method: formData.measurement_method,
    nd_code: formData.nd_code,
    nd_name: formData.nd_name,
    input_data: {
      fields: formData.input_data.fields.map(({ name, description, unit, card_index }) => ({
        name,
        description,
        unit,
        card_index,
      })),
    },
    intermediate_data: serializeIntermediateDataForApi(formData.intermediate_data.fields),
    convergence_conditions: serializeConvergenceConditionsForApi(formData.convergence_conditions),
    rounding_type: formData.rounding_type,
    rounding_decimal: formData.rounding_decimal,
    laboratory_id: laboratoryId,
    department_id: departmentId,
  };
}
