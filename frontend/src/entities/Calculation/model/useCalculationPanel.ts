import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  CHLORIDE_SALTS_RESULT_DISPLAY_KEY,
  getChlorideSaltsResultDisplay,
  isChlorideSaltsResearchMethod,
  isMassFractionOilResearchMethod,
  type ResearchMethod,
  type ResearchMethodGroup,
} from '@/entities/ResearchMethod/@x/Calculation';
import {
  formatNumberForDisplay,
  toNormalizedInputString,
  toDisplayString,
} from '@/shared/lib/formatting';
import { notify } from '@/shared/lib/notify';
import { Form } from '@/shared/ui/Form';
import { type InputRef } from '@/shared/ui/FormItems';
import { type CalculatorIconHandle } from '@/shared/ui/icons';
import { useCalculate } from './useCalculationMutations';
import type { CalculationResult, IntermediateResultValue } from '../api/calculation';
import type { Dayjs } from 'dayjs';

function toStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      result[key] = entry;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export type UseCalculationPanelParams = {
  selectedMethodId: number | null;
  methods: ResearchMethod[];
  groups: ResearchMethodGroup[];
  onCalculate?: (
    result: CalculationResult,
    inputData: Record<string, unknown>,
    laboratoryActivityDate: Dayjs | null
  ) => void;
  onLoadRegistrationData?: (
    onDataLoaded: (data: {
      initialValues: Record<string, string>;
      laboratoryActivityDate: Dayjs | null;
    }) => void
  ) => void;
  calculationFormPrefill?: {
    methodId: number;
    initialValues: Record<string, string>;
    laboratoryActivityDate: Dayjs | null;
    waxPrecipitation?: boolean;
    massFractionOilNumericC?: Record<string, string>;
  } | null;
  onLaboratoryActivityDateChange?: (date: Dayjs | null) => void;
};

/** Оркестрация панели расчёта: форма, prefill, calculate. Бизнес-логика fractional/MF oil/paraffin без изменений. */
export const useCalculationPanel = ({
  selectedMethodId,
  methods,
  groups,
  onCalculate,
  onLoadRegistrationData,
  calculationFormPrefill,
  onLaboratoryActivityDateChange,
}: UseCalculationPanelParams) => {
  const [form] = Form.useForm<Record<string, string>>();
  const [formValues, setFormValues] = useState<Record<string, string | number | undefined>>({});
  const [laboratoryActivityDate, setLaboratoryActivityDate] = useState<Dayjs | null>(null);
  const [dateError, setDateError] = useState('');
  const [calculationResults, setCalculationResults] = useState<Record<number, CalculationResult[]>>(
    {}
  );
  const [waxPrecipitation, setWaxPrecipitation] = useState(false);
  const inputRefs = useRef<Record<string, InputRef | null>>({});
  const mfOilNumericCRef = useRef<Record<string, string>>({});
  const calculateIconRef = useRef<CalculatorIconHandle>(null);
  const calculateMutation = useCalculate();
  const isCalculating = calculateMutation.isPending;

  const currentMethod = useMemo(() => {
    return methods.find(method => method.id === selectedMethodId) || null;
  }, [selectedMethodId, methods]);

  const currentMethodGroup = useMemo(() => {
    if (!currentMethod) return null;
    return groups.find(group => group.methods.some(gm => gm.id === currentMethod.id));
  }, [groups, currentMethod]);

  useEffect(() => {
    if (selectedMethodId && currentMethod) {
      if (calculationFormPrefill && calculationFormPrefill.methodId === selectedMethodId) {
        return;
      }
      form.resetFields();
      setFormValues({});
      setWaxPrecipitation(false);
      setCalculationResults(prev => {
        const newResults = { ...prev };
        delete newResults[selectedMethodId];
        return newResults;
      });
      mfOilNumericCRef.current = {};
    } else if (!selectedMethodId) {
      form.resetFields();
      setFormValues({});
      mfOilNumericCRef.current = {};
      setWaxPrecipitation(false);
    }
  }, [selectedMethodId, currentMethod, form, calculationFormPrefill]);

  useEffect(() => {
    if (
      !calculationFormPrefill ||
      !selectedMethodId ||
      calculationFormPrefill.methodId !== selectedMethodId ||
      !currentMethod
    ) {
      return;
    }

    form.setFieldsValue(calculationFormPrefill.initialValues);
    setFormValues(prev => ({
      ...prev,
      ...calculationFormPrefill.initialValues,
    }));
    if (calculationFormPrefill.massFractionOilNumericC) {
      mfOilNumericCRef.current = { ...calculationFormPrefill.massFractionOilNumericC };
    } else {
      mfOilNumericCRef.current = {};
    }

    if (calculationFormPrefill.laboratoryActivityDate) {
      setLaboratoryActivityDate(calculationFormPrefill.laboratoryActivityDate);
      setDateError('');
    } else {
      setLaboratoryActivityDate(null);
    }

    setWaxPrecipitation(calculationFormPrefill.waxPrecipitation === true);
  }, [calculationFormPrefill, selectedMethodId, currentMethod, form]);

  const onLoadRegistrationDataRef = useRef(onLoadRegistrationData);
  onLoadRegistrationDataRef.current = onLoadRegistrationData;

  useEffect(() => {
    const register = onLoadRegistrationDataRef.current;
    if (!register) {
      return;
    }
    const handleDataLoaded = (data: {
      initialValues: Record<string, string>;
      laboratoryActivityDate: Dayjs | null;
    }) => {
      form.setFieldsValue(data.initialValues);
      setFormValues(prev => ({
        ...prev,
        ...data.initialValues,
      }));
      if (data.laboratoryActivityDate) {
        setLaboratoryActivityDate(data.laboratoryActivityDate);
        setDateError('');
      }
    };

    register(handleDataLoaded);
  }, [form]);

  const prepareInputData = useCallback(
    (
      method: ResearchMethod
    ): Record<string, string | number | Record<string, Record<string, string>>> => {
      const inputData: Record<string, string | number | Record<string, Record<string, string>>> =
        {};

      if (
        method.name === 'Фракционный состав (конденсат)' ||
        method.name === 'Фракционный состав (нефть)'
      ) {
        const fieldsByCard: Record<number, typeof method.input_data.fields> = {};
        method.input_data.fields.forEach(field => {
          const cardIndex = field.card_index || 1;
          if (!fieldsByCard[cardIndex]) {
            fieldsByCard[cardIndex] = [];
          }
          fieldsByCard[cardIndex].push(field);
        });

        const card1Data: Record<string, string> = {};
        const card2Data: Record<string, string> = {};

        Object.keys(fieldsByCard).forEach(cardIndexStr => {
          const cardIndex = parseInt(cardIndexStr, 10);
          const cardFields = fieldsByCard[cardIndex];
          if (!cardFields) {
            return;
          }
          cardFields.forEach(field => {
            const fieldKey =
              field.card_index && field.card_index > 1
                ? `${method.id}_${field.name}_card_${field.card_index}`
                : `${method.id}_${field.name}`;

            const value: unknown = form.getFieldValue(fieldKey);
            const cleanedValue = toNormalizedInputString(value);

            if (field.card_index === 1) {
              card1Data[field.name] = cleanedValue;
            } else if (field.card_index === 2) {
              card2Data[field.name] = cleanedValue;
            }
          });
        });

        inputData._fractional_data = {
          card1: card1Data,
          card2: card2Data,
        };
      } else {
        method.input_data.fields.forEach(field => {
          const isColorField = isMassFractionOilResearchMethod(method) && field.name === 'Цвет';
          const fieldKey = isColorField
            ? `${method.id}_${field.name}`
            : field.card_index && field.card_index > 1
              ? `${method.id}_${field.name}_card_${field.card_index}`
              : `${method.id}_${field.name}`;

          const value: unknown = form.getFieldValue(fieldKey);

          const isMfC =
            isMassFractionOilResearchMethod(method) &&
            (field.name === 'C₁' ||
              field.name === 'C₂' ||
              field.name === 'C1' ||
              field.name === 'C2');
          if (isMfC && mfOilNumericCRef.current[fieldKey]) {
            inputData[field.name] = mfOilNumericCRef.current[fieldKey];
          } else if (isColorField) {
            inputData[field.name] = toNormalizedInputString(value);
          } else {
            const cleanedValue = toNormalizedInputString(value);
            inputData[field.name] = cleanedValue;
          }
        });
      }

      return inputData;
    },
    [form]
  );

  const handleCalculate = useCallback(async () => {
    if (!currentMethod) {
      notify.error('Метод не выбран');
      return;
    }

    if (!laboratoryActivityDate) {
      setDateError('Необходимо указать дату лабораторной деятельности');
      notify.warning('Укажите дату лабораторной деятельности');
      return;
    }

    setDateError('');

    try {
      const inputData = prepareInputData(currentMethod);

      // Специальная обработка для метода "При 20 ℃" с выпадением парафина
      if (currentMethod.name === 'При 20 ℃' && waxPrecipitation) {
        const result: CalculationResult = {
          result: 'выпадение парафина',
          unit: currentMethod.unit,
          measurement_error: undefined,
          convergence: 'satisfactory',
        };

        setCalculationResults(prev => ({
          ...prev,
          [currentMethod.id]: [result],
        }));

        if (onCalculate) {
          onCalculate(result, inputData, laboratoryActivityDate);
        }
        return;
      }

      const response = await calculateMutation.mutateAsync({
        input_data: inputData,
        research_method_id: currentMethod.id,
        equipment_data: currentMethod.equipment_data_default,
      });

      const finalInputData: Record<string, unknown> = { ...inputData };

      if (isMassFractionOilResearchMethod(currentMethod) && response.updated_input_data) {
        const updatedInputData = response.updated_input_data;
        const updatedValues: Record<string, string> = {};
        const labelsRaw = updatedInputData._mf_oil_display_labels;
        const labels = toStringRecord(labelsRaw);

        currentMethod.input_data.fields.forEach(field => {
          if (
            field.name === 'C₁' ||
            field.name === 'C₂' ||
            field.name === 'C1' ||
            field.name === 'C2'
          ) {
            const fieldKey =
              field.card_index && field.card_index > 1
                ? `${currentMethod.id}_${field.name}_card_${field.card_index}`
                : `${currentMethod.id}_${field.name}`;

            const updatedValue = updatedInputData[field.name];
            if (updatedValue !== undefined && updatedValue !== null) {
              const storedStr = toDisplayString(updatedValue);
              mfOilNumericCRef.current[fieldKey] = storedStr.replace(',', '.');
              const label = labels?.[field.name];
              const displayStr = label
                ? label
                : formatNumberForDisplay(toDisplayString(updatedValue));
              updatedValues[fieldKey] = displayStr;
              finalInputData[field.name] = updatedValue;
            }
          }
        });

        if (labels) {
          finalInputData['_mf_oil_display_labels'] = { ...labels };
        } else {
          delete finalInputData['_mf_oil_display_labels'];
        }

        if (Object.keys(updatedValues).length > 0) {
          form.setFieldsValue(updatedValues);
          setFormValues(prev => ({
            ...prev,
            ...updatedValues,
          }));
        }
      }

      if (isChlorideSaltsResearchMethod(currentMethod) && response.updated_input_data) {
        const updatedInputData = response.updated_input_data;
        const displayLabel = updatedInputData[CHLORIDE_SALTS_RESULT_DISPLAY_KEY];
        if (
          displayLabel !== undefined &&
          displayLabel !== null &&
          toDisplayString(displayLabel).trim()
        ) {
          finalInputData[CHLORIDE_SALTS_RESULT_DISPLAY_KEY] = displayLabel;
        } else {
          delete finalInputData[CHLORIDE_SALTS_RESULT_DISPLAY_KEY];
        }
      }

      const resultDisplayLabel =
        response.result_display?.trim() ||
        getChlorideSaltsResultDisplay(finalInputData) ||
        getChlorideSaltsResultDisplay(response.updated_input_data);

      const result: CalculationResult = {
        ...response,
        result: response.result ? formatNumberForDisplay(response.result) : undefined,
        result_display: resultDisplayLabel || undefined,
        measurement_error: response.measurement_error
          ? formatNumberForDisplay(response.measurement_error)
          : undefined,
        intermediate_results: response.intermediate_results
          ? Object.fromEntries(
              Object.entries(response.intermediate_results).map(
                ([key, value]): [string, string | IntermediateResultValue] => {
                  if (
                    typeof value === 'object' &&
                    value !== null &&
                    'value' in value &&
                    'reference' in value
                  ) {
                    return [key, value];
                  }
                  return [key, formatNumberForDisplay(value)];
                }
              )
            )
          : undefined,
      };

      setCalculationResults(prev => ({
        ...prev,
        [currentMethod.id]: [result],
      }));

      if (onCalculate) {
        onCalculate(result, finalInputData, laboratoryActivityDate);
      }
    } catch (error: unknown) {
      notify.error(error instanceof Error ? error.message : 'Не удалось выполнить расчёт');
    }
  }, [
    currentMethod,
    laboratoryActivityDate,
    waxPrecipitation,
    prepareInputData,
    calculateMutation,
    form,
    onCalculate,
  ]);

  const handleLaboratoryActivityDateChange = useCallback(
    (nextDate: Dayjs | null) => {
      setLaboratoryActivityDate(nextDate);
      setDateError('');
      onLaboratoryActivityDateChange?.(nextDate);
    },
    [onLaboratoryActivityDateChange]
  );

  const handleFormValuesChange = useCallback(
    (_changedValues: unknown, allValues: Record<string, string | number | undefined>) => {
      setFormValues(allValues);
    },
    []
  );

  const fields = currentMethod?.input_data?.fields || [];
  const isMassFractionOilMethod = currentMethod
    ? isMassFractionOilResearchMethod(currentMethod)
    : false;
  const isTemperature20Method = currentMethod?.name === 'При 20 ℃';
  const colorField = isMassFractionOilMethod ? fields.find(field => field.name === 'Цвет') : null;
  const fieldsWithoutColor = isMassFractionOilMethod
    ? fields.filter(field => field.name !== 'Цвет')
    : fields;

  const cardIndices = [
    ...new Set(
      fieldsWithoutColor
        .map(field => field.card_index)
        .filter((idx): idx is number => idx !== undefined)
    ),
  ].sort();

  return {
    form,
    formValues,
    setFormValues,
    laboratoryActivityDate,
    dateError,
    calculationResults,
    waxPrecipitation,
    setWaxPrecipitation,
    inputRefs,
    calculateIconRef,
    isCalculating,
    currentMethod,
    currentMethodGroup,
    handleCalculate,
    handleLaboratoryActivityDateChange,
    handleFormValuesChange,
    fieldsWithoutColor,
    colorField,
    cardIndices,
    isTemperature20Method,
    isMassFractionOilMethod,
  };
};

export type CalculationPanelViewModel = ReturnType<typeof useCalculationPanel>;
