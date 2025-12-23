import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Form, message } from 'antd';
import { BiHelpCircle } from 'react-icons/bi';
import { CalculationResultCard, ParallelCard } from '../../../entities/Cards';
import { FormItem } from '../../../features/FormItems';
import { useCalculate } from '../../../shared/model/hooks';
import Button from '../../../shared/ui/Button/Button';
import { DatePicker } from '../../../shared/ui/DatePicker';
import { Select } from '../../../shared/ui/FormItems';
import Tooltip from '../../../shared/ui/Tooltip/Tooltip';
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
}) => {
  const [form] = Form.useForm();
  const [formValues, setFormValues] = useState<Record<string, string | number | undefined>>({});
  const [laboratoryActivityDate, setLaboratoryActivityDate] = useState<Dayjs | null>(null);
  const [dateError, setDateError] = useState('');
  const [calculationResults, setCalculationResults] = useState<Record<number, CalculationResult[]>>(
    {}
  );
  const inputRefs = useRef<Record<string, InputRef | null>>({});
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
      form.resetFields();
      setFormValues({});
      setCalculationResults(prev => {
        const newResults = { ...prev };
        delete newResults[selectedMethodId];
        return newResults;
      });
    } else if (!selectedMethodId) {
      form.resetFields();
      setFormValues({});
    }
  }, [selectedMethodId, currentMethod, form]);

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
        const isColorField = method.name === 'Массовая доля нефти' && field.name === 'Цвет';
        const fieldKey = isColorField
          ? `${method.id}_${field.name}`
          : field.card_index && field.card_index > 1
            ? `${method.id}_${field.name}_card_${field.card_index}`
            : `${method.id}_${field.name}`;

        const value = form.getFieldValue(fieldKey);

        if (isColorField) {
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

      const response = await calculateMutation.mutateAsync({
        input_data: inputData,
        research_method_id: currentMethod.id,
        equipment_data: currentMethod.equipment_data_default,
      });

      const result: CalculationResult = {
        ...response,
        result: response.result ? response.result.replace('.', ',') : undefined,
        measurement_error: response.measurement_error
          ? response.measurement_error.replace('.', ',')
          : undefined,
        intermediate_results: response.intermediate_results
          ? Object.fromEntries(
              Object.entries(response.intermediate_results).map(([key, value]) => [
                key,
                typeof value === 'string'
                  ? value.replace('.', ',')
                  : String(value).replace('.', ','),
              ])
            )
          : undefined,
      };

      if (currentMethod.name === 'Массовая доля нефти' && response.updated_input_data) {
        const updatedInputData = response.updated_input_data;
        const updatedValues: Record<string, string> = {};

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
              updatedValues[fieldKey] = String(updatedValue).replace('.', ',');
            }
          }
        });

        if (Object.keys(updatedValues).length > 0) {
          form.setFieldsValue(updatedValues);
          setFormValues(prev => ({
            ...prev,
            ...updatedValues,
          }));
        }
      }

      setCalculationResults(prev => ({
        ...prev,
        [currentMethod.id]: [result],
      }));

      // Вызываем внешний колбэк, если он передан
      if (onCalculate) {
        onCalculate(result, inputData, laboratoryActivityDate);
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
  const isMassFractionOilMethod = currentMethod.name === 'Массовая доля нефти';
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
