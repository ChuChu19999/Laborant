import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { Alert, Button, DatePicker, Form, Input, message, Select, Tooltip } from 'antd';
import locale from 'antd/es/date-picker/locale/ru_RU';
import { type Dayjs } from 'dayjs';
import 'dayjs/locale/ru';
import { LoadingCard } from '../../features/Cards';
import { SaveSampleCalculationModal } from '../../features/Modals';
import { calculationApi } from '../../shared/api/calculation';
import { researchApi, type ResearchMethodResponse } from '../../shared/api/research';
import { sampleApi, type SampleResponse } from '../../shared/api/sample';
import Layout from '../../shared/ui/Layout/Layout';
import { NavigationBar } from '../../widgets/NavigationBar';
import './ResearchMethodPage.css';

const { Option } = Select;

interface AvailableMethod {
  id: string | number;
  name: string;
  is_group: boolean;
  group_id?: number;
  methods?: ResearchMethodResponse[];
  input_data?: { fields: Array<Record<string, unknown>> };
}

interface AvailableMethodsResponse {
  methods: AvailableMethod[];
}

interface CalculationResult {
  result: string;
  measurement_error?: string;
  intermediate_data?: Record<string, unknown>;
  convergence?: string;
  conditions_info?: Array<{
    satisfied: boolean;
    convergence_value: string;
    formula: string;
    calculation_steps?: {
      type: string;
      step?: { evaluated: string };
      steps?: Array<{ evaluated: string }>;
      step2?: string;
    };
  }>;
  is_fractional_composition?: boolean;
  input_data: Record<string, unknown>;
  laboratory_activity_date?: string;
}

const CONVERGENCE_LABELS: Record<string, string | ((value: string) => string)> = {
  custom: (value: string) => value,
  satisfactory: 'Удовлетворительно',
  unsatisfactory: 'Неудовлетворительно',
  absence: 'Отсутствие',
  traces: 'Следы',
};

// Функция для обработки модуля с учетом вложенных скобок
const processAbs = (formula: string): string => {
  let result = formula;
  let startIndex;
  while ((startIndex = result.indexOf('abs(')) !== -1) {
    let openBrackets = 1;
    let currentIndex = startIndex + 4;

    while (openBrackets > 0 && currentIndex < result.length) {
      if (result[currentIndex] === '(') openBrackets++;
      if (result[currentIndex] === ')') openBrackets--;
      currentIndex++;
    }

    if (openBrackets === 0) {
      const content = result.substring(startIndex + 4, currentIndex - 1);
      result =
        result.substring(0, startIndex) + '|' + content + '|' + result.substring(currentIndex);
    } else {
      break;
    }
  }
  return result;
};

// Функция для определения количества знаков после запятой
const getDecimalPlaces = (numStr: string): number => {
  if (!numStr) return 0;
  const parts = numStr.toString().split(',');
  return parts.length > 1 ? parts[1].length : 0;
};

// Функция округления
const roundValue = (value: string, mainResult: string): string => {
  const decimalPlaces = getDecimalPlaces(mainResult) + 1;
  const numValue = parseFloat(value.replace(',', '.'));
  return numValue.toFixed(decimalPlaces).replace('.', ',');
};

// Функция округления для фракционного состава нефти
const roundValueForOilFractional = (value: string, fieldName: string): string => {
  const numValue = parseFloat(value.replace(',', '.'));

  if (
    fieldName === 'Температура н.к.' ||
    fieldName === '10% отгона при температуре' ||
    fieldName === '50% отгона при температуре'
  ) {
    return Math.round(numValue).toString();
  }

  return numValue.toFixed(1).replace('.', ',');
};

// Функция округления для фракционного состава конденсата
const roundValueForCondensateFractional = (value: string, fieldName: string): string => {
  const numValue = parseFloat(value.replace(',', '.'));

  if (
    fieldName.toLowerCase().includes('температура') ||
    fieldName.toLowerCase().includes('отгона при температуре')
  ) {
    return Math.round(numValue).toString();
  }

  return numValue.toFixed(1).replace('.', ',');
};

const TabPanel: React.FC<{ children: React.ReactNode; value: number; index: number }> = ({
  children,
  value,
  index,
}) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
    >
      {value === index && children}
    </div>
  );
};

const ResearchMethodPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableMethods, setAvailableMethods] = useState<AvailableMethodsResponse | null>(null);
  const laboratoryId = parseInt(searchParams.get('laboratory') || '0', 10);
  const departmentId = searchParams.get('department')
    ? parseInt(searchParams.get('department')!, 10)
    : undefined;
  const sampleId = parseInt(searchParams.get('sample_id') || '0', 10);
  const [selectedTab, setSelectedTab] = useState(0);
  const [currentMethod, setCurrentMethod] = useState<ResearchMethodResponse | null>(null);
  const [form] = Form.useForm();
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [calculationResults, setCalculationResults] = useState<Record<number, CalculationResult[]>>(
    {}
  );
  const [lastCalculationResult, setLastCalculationResult] = useState<
    Record<number, CalculationResult | null>
  >({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [lockedMethods] = useState<Record<number, boolean>>({});
  const [laboratoryActivityDate, setLaboratoryActivityDate] = useState<Dayjs | null>(null);
  const [dateError, setDateError] = useState('');
  const [sampleData, setSampleData] = useState<SampleResponse | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Получаем данные пробы
        if (sampleId) {
          try {
            const sample = await sampleApi.getSample(sampleId);
            setSampleData(sample);
          } catch (error) {
            console.error('Ошибка при загрузке данных пробы:', error);
          }
        }

        // Получаем доступные методы
        const methodsData = await researchApi.getAvailableMethods({
          laboratory_id: laboratoryId,
          department_id: departmentId,
          sample_id: sampleId,
        });

        // API возвращает объект с ключом methods
        const methodsResponse = methodsData as { methods?: AvailableMethod[] };
        const methods = methodsResponse.methods || [];
        setAvailableMethods({ methods });

        // Выбираем первый доступный метод
        if (methods.length > 0) {
          const firstMethod = methods[0];
          if (firstMethod.is_group && firstMethod.methods && firstMethod.methods.length > 0) {
            // Для методов в группах нужно получить полные данные
            const firstGroupMethodId = firstMethod.methods[0].id as number;
            const fullMethod = await researchApi.getResearchMethod(firstGroupMethodId);
            if (!fullMethod.input_data) {
              fullMethod.input_data = { fields: [] };
            }
            setCurrentMethod(fullMethod);
          } else if (!firstMethod.is_group) {
            // Для обычных методов нужно получить полные данные
            const methodId = firstMethod.id as number;
            const fullMethod = await researchApi.getResearchMethod(methodId);
            if (!fullMethod.input_data) {
              fullMethod.input_data = { fields: [] };
            }
            setCurrentMethod(fullMethod);
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке методов:', error);
        const errorMessage =
          (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          (error as Error).message ||
          'Не удалось загрузить методы исследования';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [sampleId, laboratoryId, departmentId]);

  useEffect(() => {
    const values = form.getFieldsValue();
    setFormValues(values);
  }, [form]);

  // Устанавливаем значение по умолчанию для поля "Цвет" при смене метода
  useEffect(() => {
    if (currentMethod?.name === 'Массовая доля нефти' && currentMethod?.input_data?.fields) {
      const fields = currentMethod.input_data.fields as Array<{ name?: string }>;
      const colorField = fields.find((field: { name?: string }) => field.name === 'Цвет');
      if (colorField) {
        const colorFieldName = `${currentMethod.id}_Цвет`;
        const currentValue = form.getFieldValue(colorFieldName);
        if (currentValue === undefined || currentValue === null || currentValue === '') {
          form.setFieldValue(colorFieldName, '');
          setFormValues(prev => ({
            ...prev,
            [colorFieldName]: '',
          }));
        }
      }
    }
  }, [currentMethod?.id, currentMethod?.name, currentMethod?.input_data?.fields, form]);

  const handleCalculate = async (methodId: number) => {
    try {
      setIsCalculating(true);

      // Получаем актуальные данные метода
      const methodDetails = await researchApi.getResearchMethod(methodId);

      const inputData: Record<string, unknown> = {};

      // Специальная обработка для фракционного состава конденсата
      if (methodDetails.name === 'Фракционный состав (конденсат)') {
        const fieldsByCard: Record<number, Array<{ name: string; card_index?: number }>> = {};
        const fields =
          (methodDetails.input_data.fields as Array<{ name: string; card_index?: number }>) || [];
        fields.forEach((field: { name: string; card_index?: number }) => {
          const cardIndex = field.card_index || 1;
          if (!fieldsByCard[cardIndex]) {
            fieldsByCard[cardIndex] = [];
          }
          fieldsByCard[cardIndex].push(field);
        });

        const card1Data: Record<string, string> = {};
        const card2Data: Record<string, string> = {};

        Object.keys(fieldsByCard).forEach(cardIndex => {
          fieldsByCard[parseInt(cardIndex, 10)].forEach(field => {
            const fieldKey =
              field.card_index && field.card_index > 1
                ? `${methodId}_${field.name}_card_${field.card_index}`
                : `${methodId}_${field.name}`;

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
      } else if (methodDetails.name === 'Фракционный состав (нефть)') {
        const fieldsByCard: Record<number, Array<{ name: string; card_index?: number }>> = {};
        const fields =
          (methodDetails.input_data.fields as Array<{ name: string; card_index?: number }>) || [];
        fields.forEach((field: { name: string; card_index?: number }) => {
          const cardIndex = field.card_index || 1;
          if (!fieldsByCard[cardIndex]) {
            fieldsByCard[cardIndex] = [];
          }
          fieldsByCard[cardIndex].push(field);
        });

        const card1Data: Record<string, string> = {};
        const card2Data: Record<string, string> = {};

        Object.keys(fieldsByCard).forEach(cardIndex => {
          fieldsByCard[parseInt(cardIndex, 10)].forEach(field => {
            const fieldKey =
              field.card_index && field.card_index > 1
                ? `${methodId}_${field.name}_card_${field.card_index}`
                : `${methodId}_${field.name}`;

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
        // Обычная обработка для других методов
        const fields =
          (methodDetails.input_data.fields as Array<{ name: string; card_index?: number }>) || [];
        fields.forEach((field: { name: string; card_index?: number }) => {
          const isColorField =
            methodDetails.name === 'Массовая доля нефти' && field.name === 'Цвет';
          const fieldKey = isColorField
            ? `${methodId}_${field.name}`
            : field.card_index && field.card_index > 1
              ? `${methodId}_${field.name}_card_${field.card_index}`
              : `${methodId}_${field.name}`;
          const value = form.getFieldValue(fieldKey);

          if (isColorField) {
            inputData[field.name] = value || '';
          } else {
            const cleanedValue = value ? value.toString().trim().replace(',', '.') : '';
            inputData[field.name] = cleanedValue;
          }
        });
      }

      const response = await calculationApi.calculate({
        input_data: inputData,
        research_method_id: methodId,
      });

      const result: CalculationResult = {
        ...response,
        result: response.result ? response.result.replace('.', ',') : '',
        measurement_error: response.measurement_error
          ? response.measurement_error.replace('.', ',')
          : undefined,
        intermediate_data: response.intermediate_data
          ? Object.fromEntries(
              Object.entries(response.intermediate_data).map(([key, value]) => [
                key,
                typeof value === 'string' ? value.replace('.', ',') : value,
              ])
            )
          : undefined,
        input_data: inputData,
        laboratory_activity_date: laboratoryActivityDate?.format('YYYY-MM-DD'),
      };

      setCalculationResults(prev => ({
        ...prev,
        [methodId]: [result],
      }));

      setLastCalculationResult(prev => ({
        ...prev,
        [methodId]: result,
      }));
    } catch (error) {
      console.error('Ошибка при расчете:', error);
      message.error(
        ((error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          (error as Error).message ||
          'Ошибка при расчете') as string
      );
    } finally {
      setIsCalculating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    let value = e.target.value;
    value = value.replace(/\./g, ',');
    const pattern = /^-?\d*,?\d*$/;

    if (value === '' || value === '-' || pattern.test(value)) {
      const commaCount = (value.match(/,/g) || []).length;
      if (commaCount <= 1) {
        const minusCount = (value.match(/-/g) || []).length;
        if (minusCount <= 1 && value.indexOf('-') <= 0) {
          form.setFieldValue(fieldName, value);
          const input = e.target;
          const position = input.selectionStart;
          setTimeout(() => {
            input.setSelectionRange(position, position);
          }, 0);
        }
      }
    }
  };

  // Функция для определения параллели по description полей карточки
  const getCardParallelLabel = (cardFields: Array<{ description?: string }>): string | null => {
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

  const renderInputFields = (methodId: number) => {
    if (!currentMethod || !currentMethod.input_data || !currentMethod.input_data.fields) {
      return null;
    }

    const fields = currentMethod.input_data.fields as Array<{
      name: string;
      description?: string;
      unit?: string;
      card_index?: number;
    }>;

    const isMassFractionOilMethod = currentMethod?.name === 'Массовая доля нефти';
    const colorField = isMassFractionOilMethod ? fields.find(field => field.name === 'Цвет') : null;
    const fieldsWithoutColor = isMassFractionOilMethod
      ? fields.filter(field => field.name !== 'Цвет')
      : fields;
    const cardIndices = [
      ...new Set(
        fieldsWithoutColor.map(field => field.card_index).filter(idx => idx !== undefined)
      ),
    ].sort() as number[];

    const colorOptions = ['', 'б/цв', 'св-желт', 'жел', 'т-жел', 'св-кор', 'корич', 'т-кор'];

    const handleKeyDown = (
      e: React.KeyboardEvent<HTMLInputElement>,
      currentFieldIndex: number,
      cardFields: Array<{ name: string; card_index?: number }>
    ) => {
      if (e.ctrlKey || e.metaKey) {
        const allowedKeyCodes = ['KeyA', 'KeyC', 'KeyV', 'KeyX'];
        if (allowedKeyCodes.includes(e.code)) {
          return;
        }
      }

      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        const nextFieldIndex = (currentFieldIndex + 1) % cardFields.length;
        const nextField = cardFields[nextFieldIndex];

        const nextFieldName =
          nextField.card_index && nextField.card_index > 1
            ? `${methodId}_${nextField.name}_card_${nextField.card_index}`
            : `${methodId}_${nextField.name}`;

        if (inputRefs.current[nextFieldName]) {
          inputRefs.current[nextFieldName]?.focus();
        }
        return;
      }

      if (e.code === 'Tab') {
        e.preventDefault();
        return;
      }

      if (
        e.code === 'Backspace' ||
        e.code === 'Delete' ||
        e.code === 'Escape' ||
        e.code === 'Comma' ||
        e.code === 'Minus' ||
        e.code === 'NumpadSubtract' ||
        e.code === 'NumpadDecimal' ||
        e.code.startsWith('Digit') ||
        e.code.startsWith('Numpad')
      ) {
        return;
      }

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        return;
      }

      e.preventDefault();
    };

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          gap: '16px',
          marginBottom: '10px',
          justifyContent: 'left',
          flexWrap: 'wrap',
        }}
      >
        {cardIndices.map(cardIndex => {
          const cardFields = fieldsWithoutColor.filter(field => field.card_index === cardIndex);
          if (cardFields.length === 0) return null;

          const parallelLabel = getCardParallelLabel(cardFields);

          return (
            <div
              key={cardIndex}
              style={{
                padding: '20px',
                paddingBottom: '12px',
                background: '#f5f8ff',
                borderRadius: '16px',
                boxShadow: 'rgba(17, 12, 46, 0.05) 0px 48px 100px 0px',
                flex: '1',
                minWidth: '430px',
                maxWidth: '430px',
                border: '1px solid rgba(22, 119, 255, 0.3)',
              }}
            >
              {parallelLabel && (
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#2c5282',
                    marginBottom: '12px',
                    fontFamily: 'HeliosCondC',
                  }}
                >
                  {parallelLabel}
                </div>
              )}
              {cardFields.map((field, fieldIndex) => {
                const formFieldName =
                  field.card_index && field.card_index > 1
                    ? `${methodId}_${field.name}_card_${field.card_index}`
                    : `${methodId}_${field.name}`;
                const fieldValue = formValues[formFieldName] as string | undefined;

                const isMassFractionOilMethod = currentMethod?.name === 'Массовая доля нефти';
                const isCField =
                  field.name === 'C₁' ||
                  field.name === 'C₂' ||
                  field.name === 'C1' ||
                  field.name === 'C2';
                const shouldDisableField = isMassFractionOilMethod && isCField;

                return (
                  <div key={fieldIndex} className="input-field-container">
                    <Form.Item
                      label={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '14px' }}>{field.name}</span>
                          {field.description && (
                            <Tooltip title={field.description} placement="right">
                              <QuestionCircleOutlined
                                style={{ fontSize: '14px', color: '#999', cursor: 'help' }}
                              />
                            </Tooltip>
                          )}
                        </div>
                      }
                      name={formFieldName}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                        }}
                      >
                        <Input
                          ref={el => {
                            inputRefs.current[formFieldName] = el as HTMLInputElement | null;
                          }}
                          placeholder={`Введите ${field.name}`}
                          style={{ fontSize: '14px', flex: '1' }}
                          value={fieldValue}
                          disabled={lockedMethods[methodId] || shouldDisableField}
                          onChange={e => {
                            if (shouldDisableField) {
                              return;
                            }
                            handleInputChange(e, formFieldName);
                            setFormValues(prev => ({
                              ...prev,
                              [formFieldName]: e.target.value.replace(/\./g, ','),
                            }));
                          }}
                          onKeyDown={e => handleKeyDown(e, fieldIndex, cardFields)}
                          onPaste={e => {
                            if (shouldDisableField) {
                              e.preventDefault();
                              return;
                            }
                            e.preventDefault();
                            const pastedText = e.clipboardData.getData('text');
                            const cleanedValue = pastedText.trim().replace(/\s+/g, '');
                            form.setFieldValue(formFieldName, cleanedValue);
                            setFormValues(prev => ({
                              ...prev,
                              [formFieldName]: cleanedValue,
                            }));
                          }}
                        />
                        {field.unit && (
                          <span
                            style={{
                              color: '#666',
                              fontSize: '14px',
                              fontFamily: 'HeliosCondC',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {field.unit}
                          </span>
                        )}
                      </div>
                    </Form.Item>
                  </div>
                );
              })}
            </div>
          );
        })}
        {/* Рендерим поле "Цвет" отдельно как селект для метода "Массовая доля нефти" */}
        {colorField && (
          <div
            style={{
              padding: '20px',
              paddingBottom: '12px',
              background: '#f5f8ff',
              borderRadius: '16px',
              boxShadow: 'rgba(17, 12, 46, 0.05) 0px 48px 100px 0px',
              flex: '1',
              minWidth: '430px',
              maxWidth: '430px',
              border: '1px solid rgba(22, 119, 255, 0.3)',
            }}
          >
            <Form.Item
              label={
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '14px' }}>{colorField.name}</span>
                  {colorField.description && (
                    <Tooltip title={colorField.description} placement="right">
                      <QuestionCircleOutlined
                        style={{ fontSize: '14px', color: '#999', cursor: 'help' }}
                      />
                    </Tooltip>
                  )}
                </div>
              }
              name={`${methodId}_${colorField.name}`}
            >
              <Select
                value={
                  formValues[`${methodId}_${colorField.name}`] !== undefined &&
                  formValues[`${methodId}_${colorField.name}`] !== null
                    ? (formValues[`${methodId}_${colorField.name}`] as string)
                    : ''
                }
                onChange={value => {
                  const normalizedValue = value !== undefined && value !== null ? value : '';
                  form.setFieldValue(`${methodId}_${colorField.name}`, normalizedValue);
                  setFormValues(prev => ({
                    ...prev,
                    [`${methodId}_${colorField.name}`]: normalizedValue,
                  }));
                }}
                placeholder="Выберите цвет"
                style={{ width: '100%' }}
                disabled={lockedMethods[methodId]}
                allowClear={false}
                className="research-method-select"
              >
                {colorOptions.map((option, index) => (
                  <Option key={index} value={option || ''}>
                    {option === '' ? 'Не указано' : option}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>
        )}
      </div>
    );
  };

  const fetchMethodDetails = async (methodId: number) => {
    try {
      if (!availableMethods?.methods) {
        console.error('availableMethods.methods отсутствует');
        return;
      }

      let method: ResearchMethodResponse | null = null;
      let methodIndex = -1;

      for (let i = 0; i < availableMethods.methods.length; i++) {
        const currentMethod = availableMethods.methods[i];

        if (currentMethod.is_group && currentMethod.methods) {
          const foundMethod = currentMethod.methods.find(m => m.id === methodId);
          if (foundMethod) {
            method = foundMethod;
            methodIndex = i;
            break;
          }
        } else if ((currentMethod as unknown as ResearchMethodResponse).id === methodId) {
          method = currentMethod as unknown as ResearchMethodResponse;
          methodIndex = i;
          break;
        }
      }

      if (method) {
        if (!method.input_data) {
          method.input_data = { fields: [] };
        }
        setCurrentMethod(method);
        if (methodIndex >= 0) {
          setSelectedTab(methodIndex);
        }
      }
    } catch (error) {
      console.error('Ошибка при получении деталей метода:', error);
      message.error('Не удалось загрузить детали метода');
    }
  };

  const onFinish = async () => {
    if (!laboratoryActivityDate) {
      setDateError('Необходимо указать дату лабораторной деятельности');
      return;
    }

    try {
      if (!currentMethod) {
        message.error('Метод не выбран');
        return;
      }

      await handleCalculate(currentMethod.id);
    } catch (error) {
      console.error('Ошибка при отправке формы:', error);
      message.error('Произошла ошибка при отправке формы');
    }
  };

  const handleOpenSaveModal = () => {
    if (!laboratoryActivityDate) {
      setDateError('Укажите дату лабораторной деятельности');
      message.warning('Укажите дату лабораторной деятельности');
      setTimeout(() => {
        const datePickerElement = document.querySelector('.custom-date-picker');
        if (datePickerElement) {
          datePickerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (datePickerElement as HTMLElement).focus();
        }
      }, 100);
      return;
    }
    setDateError('');
    if (currentMethod?.id && lastCalculationResult[currentMethod.id]) {
      setIsSaveModalOpen(true);
    } else {
      message.warning('Нет результатов для сохранения');
    }
  };

  const handleCloseSaveModal = () => {
    setIsSaveModalOpen(false);
  };

  const handleSaveSuccess = async () => {
    setIsSaveModalOpen(false);

    setLastCalculationResult(prev => ({
      ...prev,
      [currentMethod!.id]: null,
    }));
    setCalculationResults(prev => ({
      ...prev,
      [currentMethod!.id]: [],
    }));

    const emptyValues: Record<string, string> = {};
    const isMassFractionOilMethod = currentMethod?.name === 'Массовая доля нефти';
    const fields =
      (currentMethod!.input_data.fields as Array<{ name: string; card_index?: number }>) || [];
    fields.forEach((field: { name: string; card_index?: number }) => {
      const isColorField = isMassFractionOilMethod && field.name === 'Цвет';
      const fieldKey = isColorField
        ? `${currentMethod!.id}_${field.name}`
        : field.card_index && field.card_index > 1
          ? `${currentMethod!.id}_${field.name}_card_${field.card_index}`
          : `${currentMethod!.id}_${field.name}`;
      emptyValues[fieldKey] = '';
    });
    form.setFieldsValue(emptyValues);
    setFormValues(prev => ({
      ...prev,
      ...emptyValues,
    }));

    try {
      message.success('Результат расчета успешно сохранен');
      // Обновляем список методов
      const methodsData = await researchApi.getAvailableMethods({
        laboratory_id: laboratoryId,
        department_id: departmentId,
        sample_id: sampleId,
      });
      const methodsResponse = methodsData as { methods?: AvailableMethod[] };
      const methods = methodsResponse.methods || [];
      setAvailableMethods({ methods });
    } catch (error) {
      console.error('Ошибка при обновлении списка методов:', error);
      message.error('Не удалось обновить список методов');
    }
  };

  if (isLoading) {
    const title = sampleData ? `Проба № ${sampleData.registration_number}` : 'Методы исследования';
    return (
      <Layout title={title}>
        <div style={{ position: 'relative' }}>
          <LoadingCard loading={isLoading} />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Ошибка">
        <Alert message={error} type="error" />
      </Layout>
    );
  }

  const hasNoMethods = !availableMethods?.methods?.length;

  const breadcrumbs = sampleData
    ? [
        { label: 'Пробы' },
        {
          label: `Проба № ${sampleData.registration_number}`,
        },
      ]
    : [{ label: 'Методы исследования' }];

  const pageTitle = sampleData
    ? `Проба № ${sampleData.registration_number}`
    : 'Методы исследования';

  return (
    <Layout title={pageTitle}>
      <NavigationBar breadcrumbs={breadcrumbs} showBack={false} />
      <Form
        form={form}
        onFinish={onFinish}
        layout="vertical"
        preserve={false}
        onValuesChange={(_changedValues, allValues) => {
          setFormValues(allValues);
        }}
      >
        <div style={{ display: 'flex', height: 'calc(100vh - 115px)', fontFamily: 'HeliosCondC' }}>
          {/* Левая панель с методами */}
          <div
            style={{
              width: '250px',
              borderRight: '1px solid rgba(44, 82, 130, 0.1)',
              overflowY: 'auto',
              padding: '12px',
              paddingBottom: '0px',
              background: 'linear-gradient(180deg, #f8faff 0%, #f0f5ff 100%)',
              height: 'calc(100% + 16px)',
              position: 'sticky',
              top: 0,
              borderBottomLeftRadius: '20px',
              fontFamily: 'HeliosCondC',
              boxShadow: 'inset -1px 0 2px rgba(44, 82, 130, 0.05)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0px',
                position: 'sticky',
                top: 0,
                background: 'linear-gradient(180deg, #f8faff 0%, #f0f5ff 100%)',
                zIndex: 1,
                paddingTop: '5px',
                paddingBottom: '16px',
                borderBottom: '1px solid rgba(44, 82, 130, 0.1)',
              }}
            >
              <h3
                style={{
                  fontSize: '16px',
                  background: 'linear-gradient(135deg, #2c5282 0%, #1a365d 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  lineHeight: 1,
                  fontWeight: 600,
                  fontFamily: 'HeliosCondC',
                }}
              >
                Методы исследования
              </h3>
            </div>

            {hasNoMethods ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#718096',
                  fontSize: '14px',
                  fontFamily: 'HeliosCondC',
                }}
              >
                Нет доступных методов исследования
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  height: 'calc(100% - 60px)',
                  overflowY: 'auto',
                  paddingRight: '4px',
                  paddingTop: '6px',
                }}
              >
                {availableMethods?.methods.map((method, index) => (
                  <div
                    key={method.id}
                    onClick={() => {
                      if (method.is_group) {
                        if (method.methods && method.methods.length > 0) {
                          const firstMethod = method.methods[0];
                          if (!firstMethod.input_data) {
                            firstMethod.input_data = { fields: [] };
                          }
                          setCurrentMethod(firstMethod);
                        }
                      } else {
                        const singleMethod = method as unknown as ResearchMethodResponse;
                        if (!singleMethod.input_data) {
                          singleMethod.input_data = { fields: [] };
                        }
                        setCurrentMethod(singleMethod);
                      }
                      setSelectedTab(index);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background:
                        (method.is_group &&
                          currentMethod &&
                          method.methods?.some(m => m.id === currentMethod.id)) ||
                        (!method.is_group &&
                          (method as unknown as ResearchMethodResponse).id === currentMethod?.id)
                          ? 'linear-gradient(135deg, rgba(44, 82, 130, 0.1) 0%, rgba(26, 54, 93, 0.15) 100%)'
                          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.6) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow:
                        (method.is_group &&
                          currentMethod &&
                          method.methods?.some(m => m.id === currentMethod.id)) ||
                        (!method.is_group &&
                          (method as unknown as ResearchMethodResponse).id === currentMethod?.id)
                          ? '0 4px 12px rgba(44, 82, 130, 0.1), inset 0 1px 1px rgba(255, 255, 255, 0.5)'
                          : '0 1px 3px rgba(44, 82, 130, 0.05), inset 0 1px 1px rgba(255, 255, 255, 0.5)',
                      border: '1px solid rgba(44, 82, 130, 0.08)',
                      backdropFilter: 'blur(8px)',
                      fontFamily: 'HeliosCondC',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background =
                        'linear-gradient(135deg, rgba(44, 82, 130, 0.08) 0%, rgba(26, 54, 93, 0.12) 100%)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background =
                        (method.is_group &&
                          currentMethod &&
                          method.methods?.some(m => m.id === currentMethod.id)) ||
                        (!method.is_group &&
                          (method as unknown as ResearchMethodResponse).id === currentMethod?.id)
                          ? 'linear-gradient(135deg, rgba(44, 82, 130, 0.1) 0%, rgba(26, 54, 93, 0.15) 100%)'
                          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.6) 100%)';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        position: 'relative',
                        zIndex: 1,
                      }}
                    >
                      <span
                        style={{
                          fontSize: '14px',
                          fontFamily: 'HeliosCondC',
                          color: '#2c5282',
                          fontWeight:
                            (method.is_group &&
                              currentMethod &&
                              method.methods?.some(m => m.id === currentMethod.id)) ||
                            (!method.is_group &&
                              (method as unknown as ResearchMethodResponse).id ===
                                currentMethod?.id)
                              ? '500'
                              : '400',
                        }}
                      >
                        {method.name === 'Фракционный состав (конденсат)'
                          ? 'Конденсат'
                          : method.name === 'Фракционный состав (нефть)'
                            ? 'Нефть'
                            : method.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Основной контент */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              position: 'relative',
              width: '100%',
              maxWidth: '100%',
              height: 'calc(100% - 10px)',
            }}
          >
            {hasNoMethods ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'left',
                  justifyContent: 'left',
                  height: '100%',
                  color: '#4a5568',
                  textAlign: 'center',
                  padding: '20px',
                }}
              >
                <h3
                  style={{
                    marginBottom: '16px',
                    color: '#2d3748',
                    fontFamily: 'HeliosCondC',
                    fontSize: '18px',
                  }}
                >
                  Методы исследования отсутствуют
                </h3>
                <p
                  style={{
                    marginBottom: '24px',
                    color: '#718096',
                    fontFamily: 'HeliosCondC',
                    fontSize: '14px',
                  }}
                >
                  Нет доступных методов исследования для данного протокола
                </p>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div
                      style={{
                        fontFamily: 'HeliosCondC',
                        color: '#2c5282',
                        fontWeight: 600,
                        fontSize: '20px',
                        marginBottom: '12px',
                      }}
                    >
                      Дата лабораторной деятельности
                    </div>
                    <div style={{ position: 'relative', width: '470px' }}>
                      <DatePicker
                        locale={locale}
                        format="DD.MM.YYYY"
                        value={laboratoryActivityDate}
                        onChange={date => {
                          setLaboratoryActivityDate(date);
                          setDateError('');
                        }}
                        placeholder="Введите дату лаб. деятельности"
                        style={{
                          width: '100%',
                          borderColor: dateError ? '#ff4d4f' : undefined,
                        }}
                        status={dateError ? 'error' : ''}
                        showToday
                        allowClear={false}
                        popupStyle={{ zIndex: 1001 }}
                        disabled={
                          currentMethod ? (lockedMethods[currentMethod.id] ?? false) : false
                        }
                        className="custom-date-picker"
                        rootClassName="custom-date-picker-root"
                        popupClassName="custom-date-picker-popup"
                        inputReadOnly={false}
                        superNextIcon={null}
                        superPrevIcon={null}
                      />
                      {dateError && (
                        <div
                          style={{
                            color: '#ff4d4f',
                            fontSize: '12px',
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            marginTop: '4px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {dateError}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {availableMethods?.methods.map((method, index) => (
                  <TabPanel key={`panel-${method.id}`} value={selectedTab} index={index}>
                    {currentMethod && (
                      <div className="calculation-form" style={{ width: '100%', maxWidth: '100%' }}>
                        <h3
                          style={{
                            color: '#2c5282',
                            fontSize: '20px',
                            fontWeight: 600,
                            textAlign: 'left',
                            marginBottom: '12px',
                            fontFamily: 'HeliosCondC',
                          }}
                        >
                          {method.is_group ? method.name : currentMethod.name}
                        </h3>

                        {method.is_group &&
                          method.methods &&
                          method.methods.length >= 1 &&
                          !method.methods.some(
                            m =>
                              m.name === 'Конденсат' ||
                              m.name === 'Нефть' ||
                              m.name === 'Фракционный состав (конденсат)' ||
                              m.name === 'Фракционный состав (нефть)'
                          ) && (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'row',
                                width: '100%',
                                gap: '16px',
                                marginBottom: '12px',
                                justifyContent: 'left',
                                flexWrap: 'wrap',
                              }}
                            >
                              <Select
                                value={
                                  currentMethod?.id &&
                                  method.methods.some(
                                    m => String(m.id) === String(currentMethod.id)
                                  )
                                    ? String(currentMethod.id)
                                    : method.methods.length > 0
                                      ? String(method.methods[0].id)
                                      : undefined
                                }
                                onChange={value => {
                                  const newMethodId = parseInt(value, 10);
                                  fetchMethodDetails(newMethodId);
                                }}
                                style={{ width: '470px' }}
                                className="research-method-select"
                              >
                                {method.methods.map(m => (
                                  <Option key={`method-${m.id}`} value={String(m.id)}>
                                    {m.name === 'Фракционный состав (конденсат)'
                                      ? 'Конденсат'
                                      : m.name === 'Фракционный состав (нефть)'
                                        ? 'Нефть'
                                        : m.name}
                                  </Option>
                                ))}
                              </Select>
                            </div>
                          )}

                        {renderInputFields(currentMethod.id)}

                        {/* Блок результатов */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            width: '100%',
                            gap: '16px',
                            marginBottom: '10px',
                            justifyContent: 'left',
                            flexWrap: 'wrap',
                          }}
                        >
                          {calculationResults[currentMethod?.id]?.map((result, resultIndex) => (
                            <div
                              key={`result-${resultIndex}`}
                              className="calculation-results"
                              style={{
                                border: '1px solid rgba(64, 150, 255, 0.3)',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                background: 'linear-gradient(to right, #f8f9ff, #f0f7ff)',
                                boxShadow: '0 4px 12px rgba(64, 150, 255, 0.08)',
                                marginTop: '8px',
                                marginBottom: '12px',
                                minWidth: '440px',
                                maxWidth: '440px',
                                flex: '1',
                              }}
                            >
                              {/* Не показываем основной результат для фракционного состава */}
                              {!result.is_fractional_composition && (
                                <div
                                  style={{
                                    color: '#2c5282',
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    marginBottom: '6px',
                                  }}
                                >
                                  Результат:
                                  {(() => {
                                    const isMassFractionOilMethod =
                                      currentMethod?.name === 'Массовая доля нефти';
                                    const csrValue = result.intermediate_data?.['Cср'] as
                                      | string
                                      | undefined;
                                    const shouldShowLessThan =
                                      isMassFractionOilMethod &&
                                      csrValue &&
                                      parseFloat(csrValue.replace(',', '.')) < 0.1;

                                    if (result.convergence === 'custom') {
                                      return shouldShowLessThan
                                        ? ' менее 0,1'
                                        : ` ${result.result}`;
                                    } else if (result.convergence === 'satisfactory') {
                                      if (shouldShowLessThan) {
                                        return ' менее 0,1';
                                      }
                                      return ` ${result.result} ± ${result.measurement_error} ${currentMethod.unit}`;
                                    } else if (result.convergence === 'absence') {
                                      return ' Отсутствие';
                                    } else if (result.convergence === 'traces') {
                                      return ' Следы';
                                    } else {
                                      return ' Неудовлетворительно';
                                    }
                                  })()}
                                </div>
                              )}

                              {/* Не показываем проверку повторяемости для фракционного состава */}
                              {!result.is_fractional_composition && (
                                <div
                                  style={{
                                    color: '#2c5282',
                                    fontSize: '15px',
                                    fontWeight: 600,
                                    marginBottom: '6px',
                                    marginTop: '8px',
                                    paddingTop: '8px',
                                    borderTop: '1px solid rgba(64, 150, 255, 0.15)',
                                  }}
                                >
                                  Проверка повторяемости:
                                </div>
                              )}
                              {!result.is_fractional_composition &&
                                result.conditions_info &&
                                result.conditions_info.map(
                                  (condition, condIndex) =>
                                    condition.satisfied && (
                                      <div
                                        key={condIndex}
                                        style={{
                                          margin: '8px 0',
                                          color: '#2c5282',
                                          fontSize: '14px',
                                          background: 'rgba(255, 255, 255, 0.5)',
                                          padding: '8px',
                                          borderRadius: '8px',
                                          borderBottom:
                                            condIndex < result.conditions_info!.length - 1
                                              ? '1px dashed rgba(64, 150, 255, 0.3)'
                                              : 'none',
                                          paddingBottom:
                                            condIndex < result.conditions_info!.length - 1
                                              ? '16px'
                                              : '8px',
                                          marginBottom:
                                            condIndex < result.conditions_info!.length - 1
                                              ? '16px'
                                              : '8px',
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontFamily: 'HeliosCondC',
                                            marginBottom: '6px',
                                            fontSize: '14px',
                                            color: '#1a365d',
                                          }}
                                        >
                                          {condition.calculation_steps?.step2
                                            ? processAbs(condition.calculation_steps.step2)
                                                .replace(/\*/g, '×')
                                                .replace(/<=/g, '≤')
                                                .replace(/>=/g, '≥')
                                                .replace(/\./g, ',')
                                                .replace(/or/g, 'или')
                                                .replace(/and/g, 'и')
                                            : processAbs(condition.formula)
                                                .replace(/\*/g, '×')
                                                .replace(/<=/g, '≤')
                                                .replace(/>=/g, '≥')
                                                .replace(/\./g, ',')
                                                .replace(/or/g, 'или')
                                                .replace(/and/g, 'и')}
                                        </div>

                                        {condition.calculation_steps && (
                                          <div
                                            style={{
                                              fontFamily: 'HeliosCondC',
                                              fontSize: '14px',
                                              color: '#4a5568',
                                              paddingBottom: '8px',
                                              borderBottom: '1px solid rgba(64, 150, 255, 0.15)',
                                            }}
                                          >
                                            {condition.calculation_steps.type === 'single'
                                              ? condition.calculation_steps.step?.evaluated
                                              : condition.calculation_steps.steps?.[0]?.evaluated}
                                          </div>
                                        )}

                                        <div
                                          style={{
                                            color: '#0066cc',
                                            marginTop: '6px',
                                            fontWeight: 500,
                                          }}
                                        >
                                          {(() => {
                                            const label =
                                              CONVERGENCE_LABELS[condition.convergence_value];
                                            return typeof label === 'function' ? label('') : label;
                                          })()}
                                        </div>
                                      </div>
                                    )
                                )}

                              {result.intermediate_data &&
                                Object.keys(result.intermediate_data).length > 0 && (
                                  <>
                                    <div
                                      style={{
                                        color: '#2c5282',
                                        fontSize: '15px',
                                        fontWeight: 600,
                                        marginBottom: '6px',
                                        marginTop: '8px',
                                        paddingTop: '8px',
                                        borderTop: '1px solid rgba(64, 150, 255, 0.15)',
                                      }}
                                    >
                                      {result.is_fractional_composition
                                        ? 'Результат:'
                                        : 'Промежуточные результаты:'}
                                    </div>
                                    {Object.entries(result.intermediate_data).map(
                                      ([name, value]) => (
                                        <div
                                          key={name}
                                          style={{
                                            color: '#4a5568',
                                            margin: '3px 0',
                                            fontSize: '14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                            }}
                                          >
                                            {name}
                                            {(() => {
                                              const intermediateFields =
                                                (currentMethod.intermediate_data?.fields as Array<{
                                                  name?: string;
                                                  description?: string;
                                                }>) || [];
                                              const foundField = intermediateFields.find(
                                                (field: { name?: string }) => field.name === name
                                              );
                                              return foundField ? (
                                                <Tooltip
                                                  title={
                                                    foundField.description || 'Описание отсутствует'
                                                  }
                                                  placement="right"
                                                >
                                                  <QuestionCircleOutlined
                                                    style={{
                                                      fontSize: '14px',
                                                      color: '#999',
                                                      cursor: 'help',
                                                    }}
                                                  />
                                                </Tooltip>
                                              ) : null;
                                            })()}
                                          </div>
                                          <span
                                            style={{
                                              color: '#2d3748',
                                              fontWeight: 500,
                                            }}
                                          >
                                            =
                                            {result.is_fractional_composition &&
                                            currentMethod.name === 'Фракционный состав (нефть)'
                                              ? roundValueForOilFractional(value as string, name)
                                              : result.is_fractional_composition &&
                                                  currentMethod.name ===
                                                    'Фракционный состав (конденсат)'
                                                ? roundValueForCondensateFractional(
                                                    value as string,
                                                    name
                                                  )
                                                : roundValue(value as string, result.result)}
                                            {(() => {
                                              const intermediateFields =
                                                (currentMethod.intermediate_data?.fields as Array<{
                                                  name?: string;
                                                  unit?: string;
                                                }>) || [];
                                              const foundField = intermediateFields.find(
                                                (field: { name?: string }) => field.name === name
                                              );
                                              return foundField?.unit ? (
                                                <span
                                                  style={{
                                                    marginLeft: '4px',
                                                    color: '#666',
                                                    fontWeight: 'normal',
                                                  }}
                                                >
                                                  {foundField.unit}
                                                </span>
                                              ) : null;
                                            })()}
                                          </span>
                                        </div>
                                      )
                                    )}
                                  </>
                                )}
                            </div>
                          ))}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'left',
                            width: '100%',
                            gap: '16px',
                          }}
                        >
                          <Button
                            type="primary"
                            onClick={() => handleCalculate(currentMethod.id)}
                            loading={isCalculating}
                            style={{ fontFamily: 'HeliosCondC' }}
                          >
                            Рассчитать
                          </Button>
                          {lastCalculationResult[currentMethod?.id] && (
                            <Button
                              type="primary"
                              onClick={handleOpenSaveModal}
                              style={{ fontFamily: 'HeliosCondC' }}
                            >
                              Сохранить результат
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </TabPanel>
                ))}
              </>
            )}
          </div>
        </div>
      </Form>

      {currentMethod && (
        <SaveSampleCalculationModal
          isOpen={isSaveModalOpen}
          onClose={handleCloseSaveModal}
          calculationResult={lastCalculationResult[currentMethod.id]}
          currentMethod={currentMethod}
          sampleId={sampleId}
          laboratoryId={laboratoryId}
          departmentId={departmentId}
          laboratoryActivityDate={laboratoryActivityDate}
          onSuccess={handleSaveSuccess}
        />
      )}
    </Layout>
  );
};

export default ResearchMethodPage;
