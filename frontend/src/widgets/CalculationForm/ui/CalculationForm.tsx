import { useState, useRef, useEffect } from 'react';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { Form, Input, Select, Button, message, Tooltip } from 'antd';
import { type Dayjs } from 'dayjs';
import 'dayjs/locale/ru';
import { LoadingCard } from '../../../features/Cards';
import { calculationApi } from '../../../shared/api/calculation';
import { DatePicker } from '../../../shared/ui/FormItems';
import type { ResearchMethodResponse } from '../../../shared/api/research';
import './CalculationForm.css';

interface CalculationFormProps {
  method: ResearchMethodResponse | null;
  laboratoryId: number;
  departmentId?: number;
  registrationNumber?: string;
  onRegistrationNumberChange?: (value: string) => void;
  onLoadRegistrationData?: () => void;
  isLoadingRegistrationData?: boolean;
  onCalculationComplete?: (result: {
    result: string;
    measurement_error?: string;
    intermediate_data?: Record<string, unknown>;
    input_data: Record<string, unknown>;
    laboratory_activity_date: Dayjs | null;
  }) => void;
  onSaveClick?: () => void;
  isLocked?: boolean;
}

const CalculationForm: React.FC<CalculationFormProps> = ({
  method,
  registrationNumber = '',
  onRegistrationNumberChange,
  onLoadRegistrationData,
  isLoadingRegistrationData = false,
  onCalculationComplete,
  onSaveClick,
  isLocked = false,
}) => {
  const [form] = Form.useForm();
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationResult, setCalculationResult] = useState<{
    result: string;
    measurement_error?: string;
    intermediate_data?: Record<string, unknown>;
    input_data: Record<string, unknown>;
    laboratory_activity_date: Dayjs | null;
  } | null>(null);
  const [laboratoryActivityDate, setLaboratoryActivityDate] = useState<Dayjs | null>(null);
  const [dateError, setDateError] = useState('');
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (method) {
      form.resetFields();
      setCalculationResult(null);
      setLaboratoryActivityDate(null);
    }
  }, [method, form]);

  if (!method) {
    return (
      <div className="calculation-form-empty">
        <p>Выберите метод исследования из списка слева</p>
      </div>
    );
  }

  const fields = method.input_data?.fields || [];

  const handleCalculate = async () => {
    if (!laboratoryActivityDate) {
      setDateError('Укажите дату лабораторной деятельности');
      message.warning('Укажите дату лабораторной деятельности');
      return;
    }
    setDateError('');

    try {
      setIsCalculating(true);

      // Собираем данные из формы
      const formValues = form.getFieldsValue();
      const inputData: Record<string, unknown> = {};

      // Специальная обработка для фракционного состава
      const isFractionalComposition =
        method.name === 'Фракционный состав (конденсат)' ||
        method.name === 'Фракционный состав (нефть)';

      if (isFractionalComposition) {
        // Группируем поля по card_index
        const fieldsByCard: Record<number, typeof fields> = {};
        fields.forEach(field => {
          const cardIndex = field.card_index || 1;
          if (!fieldsByCard[cardIndex]) {
            fieldsByCard[cardIndex] = [];
          }
          fieldsByCard[cardIndex].push(field);
        });

        const card1Data: Record<string, string> = {};
        const card2Data: Record<string, string> = {};

        Object.keys(fieldsByCard).forEach(cardIndexStr => {
          const cardIndex = Number(cardIndexStr);
          fieldsByCard[cardIndex].forEach(field => {
            const fieldKey =
              field.card_index && field.card_index > 1
                ? `${method.id}_${field.name}_card_${field.card_index}`
                : `${method.id}_${field.name}`;

            const value = formValues[fieldKey];
            const cleanedValue = value ? String(value).trim().replace(',', '.') : '';

            if (cardIndex === 1) {
              card1Data[field.name] = cleanedValue;
            } else if (cardIndex === 2) {
              card2Data[field.name] = cleanedValue;
            }
          });
        });

        inputData._fractional_data = {
          card1: card1Data,
          card2: card2Data,
        };
      } else {
        // Обычная обработка для других методов
        fields.forEach(field => {
          const isColorField = method.name === 'Массовая доля нефти' && field.name === 'Цвет';
          const fieldKey = isColorField
            ? `${method.id}_${field.name}`
            : field.card_index && field.card_index > 1
              ? `${method.id}_${field.name}_card_${field.card_index}`
              : `${method.id}_${field.name}`;

          const value = formValues[fieldKey];
          if (value !== undefined && value !== null && value !== '') {
            if (isColorField) {
              inputData[field.name] = value;
            } else {
              inputData[field.name] = String(value).replace(',', '.');
            }
          }
        });
      }

      // Вызываем API расчета
      const response = await calculationApi.calculate({
        input_data: inputData,
        research_method_id: method.id,
      });

      const result = {
        result: response.result?.replace('.', ',') || '',
        measurement_error: response.measurement_error?.replace('.', ',') || undefined,
        intermediate_data: response.intermediate_data,
        input_data,
        laboratory_activity_date: laboratoryActivityDate,
      };

      setCalculationResult(result);
      if (onCalculationComplete) {
        onCalculationComplete(result);
      }

      message.success('Расчет выполнен успешно');
    } catch (error: unknown) {
      console.error('Ошибка при расчете:', error);
      message.error('Ошибка при выполнении расчета');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, currentFieldIndex: number) => {
    // Разрешаем сочетания клавиш с Ctrl
    if (e.ctrlKey || e.metaKey) {
      const allowedKeyCodes = ['KeyA', 'KeyC', 'KeyV', 'KeyX'];
      if (allowedKeyCodes.includes(e.code)) {
        return;
      }
    }

    // Навигация по Enter
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      const nextFieldIndex = (currentFieldIndex + 1) % fields.length;
      const nextField = fields[nextFieldIndex];
      const nextFieldKey =
        nextField.card_index && nextField.card_index > 1
          ? `${method.id}_${nextField.name}_card_${nextField.card_index}`
          : `${method.id}_${nextField.name}`;

      if (inputRefs.current[nextFieldKey]) {
        inputRefs.current[nextFieldKey]?.focus();
      }
      return;
    }

    // Отключаем Tab
    if (e.code === 'Tab') {
      e.preventDefault();
      return;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    let value = e.target.value;
    // Заменяем точки на запятые при вводе
    value = value.replace(/\./g, ',');
    const pattern = /^-?\d*,?\d*$/;

    if (value === '' || value === '-' || pattern.test(value)) {
      const commaCount = (value.match(/,/g) || []).length;
      if (commaCount <= 1) {
        const minusCount = (value.match(/-/g) || []).length;
        if (minusCount <= 1 && value.indexOf('-') <= 0) {
          form.setFieldValue(fieldName, value);
        }
      }
    }
  };

  // Группируем поля по card_index
  const fieldsByCard = fields.reduce(
    (acc, field) => {
      const cardIndex = field.card_index || 1;
      if (!acc[cardIndex]) {
        acc[cardIndex] = [];
      }
      acc[cardIndex].push(field);
      return acc;
    },
    {} as Record<number, typeof fields>
  );

  const cardIndices = Object.keys(fieldsByCard)
    .map(Number)
    .sort((a, b) => a - b);

  // Функция для определения параллели по description полей карточки
  const getCardParallelLabel = (cardFields: typeof fields): string | null => {
    if (!cardFields || cardFields.length === 0) return null;

    const descriptionText = cardFields
      .map(field => (field.description || '').toLowerCase())
      .join(' ');

    if (
      descriptionText.includes('первой параллели') ||
      descriptionText.includes('первая параллель') ||
      descriptionText.includes('первой параллель')
    ) {
      return 'Параллель 1';
    }
    if (
      descriptionText.includes('второй параллели') ||
      descriptionText.includes('вторая параллель') ||
      descriptionText.includes('второй параллель')
    ) {
      return 'Параллель 2';
    }
    if (
      descriptionText.includes('третьей параллели') ||
      descriptionText.includes('третья параллель') ||
      descriptionText.includes('третьей параллель')
    ) {
      return 'Параллель 3';
    }

    return null;
  };

  return (
    <div className="calculation-form">
      <Form form={form} layout="vertical" className="calculation-form-content">
        {/* Поле регистрационного номера */}
        {onRegistrationNumberChange && (
          <div className="registration-section">
            <div className="registration-input-group">
              <Input
                value={registrationNumber}
                onChange={e => onRegistrationNumberChange(e.target.value)}
                placeholder="Введите регистрационный номер пробы"
                style={{ flex: 1 }}
                disabled={isLocked}
              />
              <Button
                onClick={onLoadRegistrationData}
                loading={isLoadingRegistrationData || isCalculating}
                disabled={isLocked}
              >
                Показать
              </Button>
            </div>
          </div>
        )}

        {/* Поле даты лабораторной деятельности */}
        <Form.Item
          label="Дата лабораторной деятельности"
          required
          className="date-picker-item"
          validateStatus={dateError ? 'error' : ''}
          help={dateError}
        >
          <DatePicker
            value={laboratoryActivityDate}
            onChange={date => {
              setLaboratoryActivityDate(date);
              setDateError('');
            }}
            format="DD.MM.YYYY"
            className="custom-date-picker"
            style={{ width: '100%' }}
            disabled={isLocked}
          />
        </Form.Item>

        {/* Поля ввода данных */}
        <div className="input-fields-container">
          {cardIndices.map(cardIndex => {
            const cardFields = fieldsByCard[cardIndex];
            const parallelLabel = getCardParallelLabel(cardFields);
            const isMassFractionOil = method.name === 'Массовая доля нефти';
            const colorField = isMassFractionOil ? cardFields.find(f => f.name === 'Цвет') : null;
            const fieldsWithoutColor = isMassFractionOil
              ? cardFields.filter(f => f.name !== 'Цвет')
              : cardFields;

            // Проверяем, нужно ли блокировать поля C1/C2 для метода "Массовая доля нефти"
            const shouldDisableCFields = (fieldName: string): boolean => {
              return (
                isMassFractionOil &&
                (fieldName === 'C₁' ||
                  fieldName === 'C₂' ||
                  fieldName === 'C1' ||
                  fieldName === 'C2')
              );
            };

            return (
              <div key={cardIndex} className="input-card" data-card-index={cardIndex}>
                {parallelLabel && <div className="parallel-label">{parallelLabel}</div>}
                {fieldsWithoutColor.map((field, fieldIndex) => {
                  const fieldKey =
                    field.card_index && field.card_index > 1
                      ? `${method.id}_${field.name}_card_${field.card_index}`
                      : `${method.id}_${field.name}`;

                  const isDisabled = isLocked || shouldDisableCFields(field.name);

                  return (
                    <Form.Item
                      key={fieldIndex}
                      label={
                        <div className="field-label">
                          <span>{field.name}</span>
                          {field.description && (
                            <Tooltip title={field.description} placement="right">
                              <span className="field-help-icon">
                                <QuestionCircleOutlined />
                              </span>
                            </Tooltip>
                          )}
                        </div>
                      }
                      name={fieldKey}
                    >
                      <div className="input-with-unit">
                        <Input
                          ref={el => {
                            inputRefs.current[fieldKey] = el;
                          }}
                          placeholder={`Введите ${field.name}`}
                          value={form.getFieldValue(fieldKey)}
                          onChange={e => {
                            if (shouldDisableCFields(field.name)) {
                              return;
                            }
                            handleInputChange(e, fieldKey);
                          }}
                          onKeyDown={e => handleKeyDown(e, fieldIndex)}
                          disabled={isCalculating || isDisabled}
                          onPaste={e => {
                            if (shouldDisableCFields(field.name)) {
                              e.preventDefault();
                              return;
                            }
                            e.preventDefault();
                            const pastedText = e.clipboardData.getData('text');
                            const cleanedValue = pastedText.trim().replace(/\s+/g, '');
                            form.setFieldValue(fieldKey, cleanedValue);
                          }}
                        />
                        {field.unit && <span className="input-unit">{field.unit}</span>}
                      </div>
                    </Form.Item>
                  );
                })}

                {/* Поле "Цвет" для метода "Массовая доля нефти" */}
                {colorField && (
                  <Form.Item
                    label={
                      <div className="field-label">
                        <span>{colorField.name}</span>
                        {colorField.description && (
                          <Tooltip title={colorField.description} placement="right">
                            <span className="field-help-icon">
                              <QuestionCircleOutlined />
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    }
                    name={`${method.id}_${colorField.name}`}
                  >
                    <Select
                      placeholder="Выберите цвет"
                      options={[
                        { value: '', label: 'Не указано' },
                        { value: 'б/цв', label: 'б/цв' },
                        { value: 'св-желт', label: 'св-желт' },
                        { value: 'жел', label: 'жел' },
                        { value: 'т-жел', label: 'т-жел' },
                        { value: 'св-кор', label: 'св-кор' },
                        { value: 'корич', label: 'корич' },
                        { value: 'т-кор', label: 'т-кор' },
                      ]}
                      disabled={isCalculating || isLocked}
                    />
                  </Form.Item>
                )}
              </div>
            );
          })}
        </div>

        {/* Кнопки расчета и сохранения */}
        <Form.Item>
          <div className="calculation-buttons">
            <Button
              type="primary"
              onClick={handleCalculate}
              loading={isCalculating}
              disabled={!laboratoryActivityDate || isLocked}
              block
            >
              Рассчитать
            </Button>
            {calculationResult && onSaveClick && (
              <Button
                type="default"
                onClick={onSaveClick}
                disabled={isLocked}
                block
                style={{ marginTop: 8 }}
              >
                Сохранить расчет
              </Button>
            )}
          </div>
        </Form.Item>

        {/* Результаты расчета */}
        {calculationResult && (
          <div className="calculation-results">
            <div className="result-item">
              <strong>Результат:</strong> {calculationResult.result} {method.unit}
            </div>
            {calculationResult.measurement_error && (
              <div className="result-item">
                <strong>Погрешность:</strong> ±{calculationResult.measurement_error}
              </div>
            )}
            {calculationResult.intermediate_data &&
              Object.keys(calculationResult.intermediate_data).length > 0 && (
                <div className="intermediate-results">
                  <strong>Промежуточные результаты:</strong>
                  {Object.entries(calculationResult.intermediate_data).map(([key, value]) => (
                    <div key={key} className="intermediate-item">
                      {key}: {String(value).replace('.', ',')}
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}
      </Form>

      {isCalculating && <LoadingCard />}
    </div>
  );
};

export default CalculationForm;
