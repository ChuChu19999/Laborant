import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Checkbox, Form, message } from 'antd';
import { BiHelpCircle } from 'react-icons/bi';
import { CalculationResultCard, ParallelCard } from '../../../entities/Cards';
import { FormItem } from '../../../features/FormItems';
import { useCalculate } from '../../../shared/model/hooks';
import Button from '../../../shared/ui/Button/Button';
import { DatePicker } from '../../../shared/ui/DatePicker';
import { Select } from '../../../shared/ui/FormItems';
import Tooltip from '../../../shared/ui/Tooltip/Tooltip';
import {
  CHLORIDE_SALTS_RESULT_DISPLAY_KEY,
  getChlorideSaltsResultDisplay,
  isChlorideSaltsResearchMethod,
} from '../../../shared/utils/chlorideSaltsMethod';
import { isMassFractionOilResearchMethod } from '../../../shared/utils/massFractionOilMethod';
import { formatNumberForDisplay } from '../../../shared/utils/numberFormatting';
import type { CalculationResult } from '../../../shared/api/calculation';
import type { ResearchMethod, ResearchMethodGroup } from '../../../shared/api/research';
import type { InputRef } from 'antd';
import type { Dayjs } from 'dayjs';
import './CalculationPanel.css';

const { Option } = Select;

interface CalculationPanelProps {
  hasNoMethods: boolean;
  selectedMethodId: number | null;
  methods: ResearchMethod[];
  groups: ResearchMethodGroup[];
  groupSelector?: React.ReactNode;
  onCalculate?: (
    result: CalculationResult,
    inputData: Record<string, unknown>,
    laboratoryActivityDate: Dayjs | null
  ) => void;
  onSave?: () => void;
  lastCalculationResult?: {
    input_data: Record<string, unknown>;
    result: string;
    result_display?: string;
    measurement_error?: string;
    unit?: string;
    convergence?: string;
  };
  laboratoryId?: number;
  departmentId?: number;
  onLoadRegistrationData?: (
    onDataLoaded: (data: {
      initialValues: Record<string, string>;
      laboratoryActivityDate: Dayjs | null;
    }) => void
  ) => void;
  /** Предзаполнение формы из сохранённого расчёта (редактирование). */
  calculationFormPrefill?: {
    methodId: number;
    initialValues: Record<string, string>;
    laboratoryActivityDate: Dayjs | null;
    waxPrecipitation?: boolean;
    massFractionOilNumericC?: Record<string, string>;
  } | null;
  /** Синхронизация даты с родителем после «Рассчитать», если пользователь меняет дату перед сохранением. */
  onLaboratoryActivityDateChange?: (date: Dayjs | null) => void;
}

const CalculationPanel: React.FC<CalculationPanelProps> = ({
  hasNoMethods,
  selectedMethodId,
  methods,
  groups,
  groupSelector,
  onCalculate,
  onSave,
  lastCalculationResult,
  onLoadRegistrationData,
  calculationFormPrefill,
  onLaboratoryActivityDateChange,
}) => {
  const [form] = Form.useForm();
  const [formValues, setFormValues] = useState<Record<string, string | number | undefined>>({});
  const [laboratoryActivityDate, setLaboratoryActivityDate] = useState<Dayjs | null>(null);
  const [dateError, setDateError] = useState('');
  const [calculationResults, setCalculationResults] = useState<Record<number, CalculationResult[]>>(
    {}
  );
  const [waxPrecipitation, setWaxPrecipitation] = useState(false);
  const inputRefs = useRef<Record<string, InputRef | null>>({});
  const mfOilNumericCRef = useRef<Record<string, string>>({});
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

  useEffect(() => {
    if (onLoadRegistrationData) {
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

      onLoadRegistrationData(handleDataLoaded);
    }
  }, [onLoadRegistrationData, form]);

  const prepareInputData = (
    method: ResearchMethod
  ): Record<string, string | number | Record<string, Record<string, string>>> => {
    const inputData: Record<string, string | number | Record<string, Record<string, string>>> = {};

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
        fieldsByCard[cardIndex].forEach(field => {
          const fieldKey =
            field.card_index && field.card_index > 1
              ? `${method.id}_${field.name}_card_${field.card_index}`
              : `${method.id}_${field.name}`;

          const value = form.getFieldValue(fieldKey);
          const cleanedValue = value ? value.toString().trim().replace(',', '.') : '';

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

        const value = form.getFieldValue(fieldKey);

        const isMfC =
          isMassFractionOilResearchMethod(method) &&
          (field.name === 'C₁' ||
            field.name === 'C₂' ||
            field.name === 'C1' ||
            field.name === 'C2');
        if (isMfC && mfOilNumericCRef.current[fieldKey]) {
          inputData[field.name] = mfOilNumericCRef.current[fieldKey];
        } else if (isColorField) {
          inputData[field.name] = value || '';
        } else {
          const cleanedValue = value ? value.toString().trim().replace(',', '.') : '';
          inputData[field.name] = cleanedValue;
        }
      });
    }

    return inputData;
  };

  const handleCalculate = async () => {
    if (!currentMethod) {
      message.error('Метод не выбран');
      return;
    }

    if (!laboratoryActivityDate) {
      setDateError('Необходимо указать дату лабораторной деятельности');
      message.warning('Укажите дату лабораторной деятельности');
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
        const updatedInputData = response.updated_input_data as Record<string, unknown>;
        const updatedValues: Record<string, string> = {};
        const labels = updatedInputData._mf_oil_display_labels as
          | Record<string, string>
          | undefined;

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
              const storedStr = String(updatedValue);
              mfOilNumericCRef.current[fieldKey] = storedStr.replace(',', '.');
              const displayStr = labels?.[field.name]
                ? labels[field.name]
                : formatNumberForDisplay(String(updatedValue));
              updatedValues[fieldKey] = displayStr;
              finalInputData[field.name] = updatedValue;
            }
          }
        });

        if (labels && typeof labels === 'object') {
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
        const updatedInputData = response.updated_input_data as Record<string, unknown>;
        const displayLabel = updatedInputData[CHLORIDE_SALTS_RESULT_DISPLAY_KEY];
        if (displayLabel !== undefined && displayLabel !== null && String(displayLabel).trim()) {
          finalInputData[CHLORIDE_SALTS_RESULT_DISPLAY_KEY] = displayLabel;
        } else {
          delete finalInputData[CHLORIDE_SALTS_RESULT_DISPLAY_KEY];
        }
      }

      const resultDisplayLabel =
        response.result_display?.trim() ||
        getChlorideSaltsResultDisplay(finalInputData) ||
        getChlorideSaltsResultDisplay(
          response.updated_input_data as Record<string, unknown> | undefined
        );

      const result: CalculationResult = {
        ...response,
        result: response.result ? formatNumberForDisplay(response.result) : undefined,
        result_display: resultDisplayLabel || undefined,
        measurement_error: response.measurement_error
          ? formatNumberForDisplay(response.measurement_error)
          : undefined,
        intermediate_results: response.intermediate_results
          ? Object.fromEntries(
              Object.entries(response.intermediate_results).map(([key, value]) => {
                if (
                  typeof value === 'object' &&
                  value !== null &&
                  'value' in value &&
                  'reference' in value
                ) {
                  return [key, value];
                }
                return [key, formatNumberForDisplay(value as string | number)];
              })
            )
          : undefined,
      };

      setCalculationResults(prev => ({
        ...prev,
        [currentMethod.id]: [result],
      }));

      // Вызываем внешний колбэк, если он передан
      if (onCalculate) {
        onCalculate(result, finalInputData, laboratoryActivityDate);
      }
    } catch (error: unknown) {
      console.error('Ошибка при расчете:', error);
    }
  };

  if (hasNoMethods) {
    return (
      <div className="calculation-panel">
        <Form form={form} className="calculation-panel-form-hidden">
          <div />
        </Form>
        <div className="calculation-panel-empty">
          <h3 className="calculation-panel-empty-title">Методы исследования отсутствуют</h3>
          <p className="calculation-panel-empty-description">
            Добавьте первый метод исследования, нажав на кнопку "+" в левой панели
          </p>
        </div>
      </div>
    );
  }

  if (!selectedMethodId || !currentMethod) {
    return (
      <div className="calculation-panel">
        <Form form={form} className="calculation-panel-form-hidden">
          <div />
        </Form>
        <div className="calculation-panel-empty">
          <p className="calculation-panel-empty-description">Выберите метод исследования</p>
        </div>
      </div>
    );
  }

  const fields = currentMethod.input_data?.fields || [];
  const isMassFractionOilMethod = isMassFractionOilResearchMethod(currentMethod);
  const isTemperature20Method = currentMethod.name === 'При 20 ℃';
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

  const colorOptions = ['', 'б/цв', 'св-желт', 'жел', 'т-жел', 'св-кор', 'корич', 'т-кор'];

  return (
    <div className="calculation-panel">
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        onValuesChange={(_changedValues, allValues) => {
          setFormValues(allValues);
        }}
      >
        <div className="calculation-panel-content">
          <div className="calculation-panel-date-section">
            <div className="calculation-panel-date-label">Дата лабораторной деятельности</div>
            <div className="calculation-panel-date-wrapper">
              <DatePicker
                value={laboratoryActivityDate}
                onChange={date => {
                  setLaboratoryActivityDate(date);
                  setDateError('');
                  onLaboratoryActivityDateChange?.(date);
                }}
                placeholder="Введите дату лабораторной деятельности"
                showToday
                allowClear={true}
                className={`calculation-panel-date-picker ${dateError ? 'date-picker-error' : ''}`}
                status={dateError ? 'error' : ''}
              />
              {dateError && <div className="calculation-panel-date-error">{dateError}</div>}
            </div>
          </div>

          <div className="calculation-panel-method-title">
            {currentMethodGroup ? currentMethodGroup.name : currentMethod.name}
          </div>

          {groupSelector}

          {isTemperature20Method && (
            <div className="wax-precipitation-wrapper">
              <FormItem name={`${currentMethod.id}_wax_precipitation`}>
                <Checkbox
                  checked={waxPrecipitation}
                  onChange={e => {
                    setWaxPrecipitation(e.target.checked);
                  }}
                >
                  Выпадение парафина
                </Checkbox>
              </FormItem>
            </div>
          )}

          <div className="calculation-panel-cards-wrapper">
            {cardIndices.map(cardIndex => {
              const cardFields = fieldsWithoutColor.filter(field => field.card_index === cardIndex);
              if (cardFields.length === 0) return null;

              return (
                <ParallelCard
                  key={cardIndex}
                  cardIndex={cardIndex}
                  fields={cardFields}
                  methodId={currentMethod.id}
                  formValues={formValues}
                  form={form}
                  setFormValues={setFormValues}
                  inputRefs={inputRefs}
                  currentMethod={currentMethod}
                  lockedMethods={
                    isTemperature20Method && waxPrecipitation ? { [currentMethod.id]: true } : {}
                  }
                />
              );
            })}
            {colorField && (
              <div className="parallel-card">
                <FormItem
                  title={
                    <div className="parallel-card-title-wrapper">
                      <span className="parallel-card-title-text">{colorField.name}</span>
                      <Tooltip title={colorField.description || ''} placement="right">
                        <BiHelpCircle size={16} className="parallel-card-title-icon" />
                      </Tooltip>
                    </div>
                  }
                  name={`${currentMethod.id}_${colorField.name}`}
                >
                  <Select
                    value={
                      formValues[`${currentMethod.id}_${colorField.name}`] !== undefined &&
                      formValues[`${currentMethod.id}_${colorField.name}`] !== null
                        ? formValues[`${currentMethod.id}_${colorField.name}`]
                        : ''
                    }
                    onChange={value => {
                      const normalizedValue: string | number | undefined =
                        value !== undefined && value !== null && typeof value !== 'object'
                          ? typeof value === 'string' || typeof value === 'number'
                            ? value
                            : String(value)
                          : '';
                      form.setFieldValue(`${currentMethod.id}_${colorField.name}`, normalizedValue);
                      setFormValues(prev => ({
                        ...prev,
                        [`${currentMethod.id}_${colorField.name}`]: normalizedValue,
                      }));
                    }}
                    placeholder="Выберите цвет"
                    allowClear={false}
                    className="research-method-select parallel-card-select"
                    disabled={isTemperature20Method && waxPrecipitation}
                  >
                    {colorOptions.map((option, index) => (
                      <Option key={index} value={option || ''}>
                        {option === '' ? 'Не указано' : option}
                      </Option>
                    ))}
                  </Select>
                </FormItem>
              </div>
            )}
          </div>

          {(calculationResults[currentMethod.id] &&
            calculationResults[currentMethod.id].length > 0) ||
          lastCalculationResult ? (
            <div className="calculation-panel-results-wrapper">
              {calculationResults[currentMethod.id]?.map((result, index) => (
                <CalculationResultCard key={index} result={result} currentMethod={currentMethod} />
              ))}
              {lastCalculationResult && !calculationResults[currentMethod.id] && (
                <CalculationResultCard
                  result={{
                    result: lastCalculationResult.result,
                    result_display:
                      lastCalculationResult.result_display ||
                      getChlorideSaltsResultDisplay(lastCalculationResult.input_data),
                    measurement_error: lastCalculationResult.measurement_error,
                    unit: lastCalculationResult.unit,
                    convergence: lastCalculationResult.convergence,
                  }}
                  currentMethod={currentMethod}
                />
              )}
            </div>
          ) : null}

          <div className="calculation-panel-actions">
            <Button type="primary" onClick={handleCalculate} loading={isCalculating}>
              Рассчитать
            </Button>
            {onSave && lastCalculationResult && (
              <Button type="primary" onClick={onSave}>
                Сохранить результат
              </Button>
            )}
          </div>
        </div>
      </Form>
    </div>
  );
};

export default CalculationPanel;
