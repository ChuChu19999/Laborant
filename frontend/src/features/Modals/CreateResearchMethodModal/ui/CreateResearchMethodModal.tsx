import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Input, Select, Checkbox, Button, message, Tabs } from 'antd';
import { fixturesApi } from '../../../../shared/api/fixtures';
import {
  researchApi,
  type ResearchMethodCreate,
  type ResearchMethodGroupCreate,
} from '../../../../shared/api/research';
import FormulaKeyboard from '../../../../shared/ui/FormulaKeyboard';
import Modal from '../../../../shared/ui/Modal/ui/Modal';
import './CreateResearchMethodModal.css';

const { TabPane } = Tabs;
const { Option } = Select;

interface CreateResearchMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  laboratoryId?: number;
  departmentId?: number;
}

const SAMPLE_TYPE_OPTIONS = [
  { value: 'oil', label: 'Нефть' },
  { value: 'condensate', label: 'Дегазированный конденсат' },
  { value: 'oil_condensate_mixture', label: 'Нефтеконденсатная смесь' },
  { value: 'diesel_fuel', label: 'Дизельное топливо' },
  { value: 'spent_oil_products', label: 'Отработанные нефтепродукты' },
  { value: 'turbine_oil', label: 'Масло турбинное' },
  { value: 'aviation_oil', label: 'Масло авиационное' },
  { value: 'liquid_hydrocarbons_mixture', label: 'Смесь жидких углеводородов' },
  { value: 'corrosion_inhibitor', label: 'Ингибитор коррозии' },
];

const CreateResearchMethodModal: React.FC<CreateResearchMethodModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'single' | 'group'>('single');
  const [activeFormulaField, setActiveFormulaField] = useState<string | null>(null);
  const [selectedFixture, setSelectedFixture] = useState<string>('');
  const [isLoadingFixtures, setIsLoadingFixtures] = useState(false);
  const [fixtures, setFixtures] = useState<Record<string, unknown>>({});
  const formulaRef = useRef<HTMLInputElement>(null);

  const [groupData, setGroupData] = useState<{ name: string; selectedMethods: number[] }>({
    name: '',
    selectedMethods: [],
  });

  const [formData, setFormData] = useState<Partial<ResearchMethodCreate>>({
    name: '',
    sample_type: ['condensate'],
    formula: '',
    measurement_error: {
      type: 'fixed',
      value: '',
    },
    unit: '',
    measurement_method: '',
    nd_code: '',
    nd_name: '',
    input_data: {
      fields: [{ name: '', description: '', unit: '', card_index: 1 }],
    },
    intermediate_data: {
      fields: [
        {
          name: '',
          formula: '',
          description: '',
          unit: '',
          show_calculation: true,
        },
      ],
    },
    convergence_conditions: {
      formulas: [
        {
          formula: '',
          convergence_value: 'satisfactory',
        },
      ],
    },
    rounding_type: 'decimal',
    rounding_decimal: 0,
  });

  // Загрузка доступных методов для группы
  const { data: availableMethodsData } = useQuery({
    queryKey: ['available-research-methods', laboratoryId, departmentId],
    queryFn: () =>
      researchApi.listResearchMethods({
        laboratory_id: laboratoryId,
        department_id: departmentId,
        page: 1,
        page_size: 100,
      }),
    enabled: activeTab === 'group' && isOpen,
  });

  // Загрузка фикстур
  useEffect(() => {
    if (isOpen && activeTab === 'single') {
      loadFixtures();
    }
  }, [isOpen, activeTab]);

  const loadFixtures = async () => {
    setIsLoadingFixtures(true);
    try {
      const fixturePaths = await fixturesApi.listFixtures();
      const fixturesData: Record<string, unknown> = {};

      // Загружаем данные для каждой фикстуры
      for (const path of fixturePaths) {
        try {
          const data = await fixturesApi.getFixture(path);
          fixturesData[path] = data;
        } catch (error) {
          console.error(`Ошибка при загрузке фикстуры ${path}:`, error);
        }
      }

      setFixtures(fixturesData);
    } catch (error) {
      console.error('Ошибка при загрузке фикстур:', error);
    } finally {
      setIsLoadingFixtures(false);
    }
  };

  const applyFixture = (fixturePath: string) => {
    const fixtureData = fixtures[fixturePath] as typeof formData;
    if (!fixtureData) return;

    setFormData({
      name: fixtureData.name || '',
      sample_type: Array.isArray(fixtureData.sample_type)
        ? fixtureData.sample_type
        : [fixtureData.sample_type || 'condensate'],
      formula: fixtureData.formula || '',
      measurement_error: fixtureData.measurement_error || { type: 'fixed', value: '' },
      unit: fixtureData.unit || '',
      measurement_method: fixtureData.measurement_method || '',
      nd_code: fixtureData.nd_code || '',
      nd_name: fixtureData.nd_name || '',
      input_data: fixtureData.input_data || {
        fields: [{ name: '', description: '', unit: '', card_index: 1 }],
      },
      intermediate_data: fixtureData.intermediate_data || {
        fields: [{ name: '', formula: '', description: '', unit: '', show_calculation: true }],
      },
      convergence_conditions: fixtureData.convergence_conditions,
      rounding_type: fixtureData.rounding_type || 'decimal',
      rounding_decimal: fixtureData.rounding_decimal || 0,
    });
  };

  const createMethodMutation = useMutation({
    mutationFn: (data: ResearchMethodCreate) => researchApi.createResearchMethod(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-methods'] });
      message.success('Метод исследования успешно создан');
      handleClose();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: unknown) => {
      console.error('Ошибка при создании метода:', error);
      message.error('Ошибка при создании метода исследования');
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: (data: ResearchMethodGroupCreate) => researchApi.createResearchMethodGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-methods'] });
      queryClient.invalidateQueries({ queryKey: ['research-method-groups'] });
      message.success('Группа методов успешно создана');
      handleClose();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: unknown) => {
      console.error('Ошибка при создании группы:', error);
      message.error('Ошибка при создании группы методов');
    },
  });

  const handleInputChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFormulaKeyPress = (value: string) => {
    if (!formulaRef.current) return;

    const input = formulaRef.current;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;

    if (value === 'backspace') {
      if (start !== end) {
        const newValue = input.value.substring(0, start) + input.value.substring(end);
        handleInputChange('formula', newValue);
        setTimeout(() => {
          input.selectionStart = input.selectionEnd = start;
          input.focus();
        }, 0);
      } else if (start > 0) {
        const newValue = input.value.substring(0, start - 1) + input.value.substring(end);
        handleInputChange('formula', newValue);
        setTimeout(() => {
          input.selectionStart = input.selectionEnd = start - 1;
          input.focus();
        }, 0);
      }
    } else {
      const newValue = input.value.substring(0, start) + value + input.value.substring(end);
      handleInputChange('formula', newValue);
      setTimeout(() => {
        input.selectionStart = input.selectionEnd = start + value.length;
        input.focus();
      }, 0);
    }
  };

  const getAvailableVariables = (currentIndex?: number): string[] => {
    const inputFields = (formData.input_data?.fields || []).map(field => field.name);
    const intermediateFields = (formData.intermediate_data?.fields || []).map(field => field.name);

    // Для промежуточных вычислений доступны только переменные, определенные выше
    if (currentIndex !== undefined && currentIndex !== null) {
      const previousIntermediateVars = intermediateFields.slice(0, currentIndex);
      return [...inputFields, ...previousIntermediateVars].filter(name => name.trim() !== '');
    }

    // Для основной формулы доступны все переменные
    return [...inputFields, ...intermediateFields].filter(name => name.trim() !== '');
  };

  const handleSubmit = () => {
    if (activeTab === 'group') {
      if (!groupData.name.trim()) {
        message.error('Введите название группы');
        return;
      }

      if (groupData.selectedMethods.length === 0) {
        message.error('Выберите хотя бы один метод для группы');
        return;
      }

      const groupDataToSend: ResearchMethodGroupCreate = {
        name: groupData.name,
        method_ids: groupData.selectedMethods,
      };

      createGroupMutation.mutate(groupDataToSend);
    } else {
      if (!formData.name?.trim()) {
        message.error('Введите название метода');
        return;
      }

      if (!formData.sample_type || formData.sample_type.length === 0) {
        message.error('Выберите хотя бы один тип пробы');
        return;
      }

      if (!formData.formula?.trim()) {
        message.error('Введите формулу расчета');
        return;
      }

      if (!formData.measurement_method?.trim()) {
        message.error('Введите метод измерения');
        return;
      }

      if (!formData.nd_code?.trim()) {
        message.error('Введите шифр НД');
        return;
      }

      if (!formData.nd_name?.trim()) {
        message.error('Введите наименование НД');
        return;
      }

      const dataToSend: ResearchMethodCreate = {
        name: formData.name,
        sample_type: formData.sample_type,
        formula: formData.formula,
        measurement_error: formData.measurement_error || { type: 'fixed', value: '' },
        unit: formData.unit || '',
        measurement_method: formData.measurement_method || '',
        nd_code: formData.nd_code || '',
        nd_name: formData.nd_name || '',
        input_data: formData.input_data || { fields: [] },
        intermediate_data: formData.intermediate_data || { fields: [] },
        convergence_conditions: formData.convergence_conditions,
        rounding_type: formData.rounding_type || 'decimal',
        rounding_decimal: formData.rounding_decimal || 0,
        laboratory_id: laboratoryId,
        department_id: departmentId,
      };

      createMethodMutation.mutate(dataToSend);
    }
  };

  const handleClose = () => {
    if (!createMethodMutation.isPending && !createGroupMutation.isPending) {
      setFormData({
        name: '',
        sample_type: ['condensate'],
        formula: '',
        measurement_error: { type: 'fixed', value: '' },
        unit: '',
        measurement_method: '',
        nd_code: '',
        nd_name: '',
        input_data: { fields: [{ name: '', description: '', unit: '', card_index: 1 }] },
        intermediate_data: {
          fields: [{ name: '', formula: '', description: '', unit: '', show_calculation: true }],
        },
        convergence_conditions: {
          formulas: [{ formula: '', convergence_value: 'satisfactory' }],
        },
        rounding_type: 'decimal',
        rounding_decimal: 0,
      });
      setGroupData({ name: '', selectedMethods: [] });
      setSelectedFixture('');
      setActiveFormulaField(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      header="Добавить метод исследования"
      onClose={handleClose}
      onCancel={handleClose}
      onSave={handleSubmit}
      saveButtonText="Создать"
      showEditButton={false}
      editable={false}
      style={{ width: '800px', maxHeight: '90vh' }}
    >
      <div className="create-research-method-form">
        <Tabs activeKey={activeTab} onChange={key => setActiveTab(key as 'single' | 'group')}>
          <TabPane tab="Одиночный метод" key="single">
            <div className="form-section">
              {/* Фикстуры */}
              <div className="form-group">
                <label>Выберите готовый метод (опционально)</label>
                {isLoadingFixtures ? (
                  <div>Загрузка методов...</div>
                ) : (
                  <Select
                    value={selectedFixture || undefined}
                    onChange={value => {
                      setSelectedFixture(value || '');
                      if (value) {
                        applyFixture(value);
                      }
                    }}
                    placeholder="Выберите метод из списка"
                    allowClear
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={Object.entries(fixtures).map(([key, fixture]) => {
                      const f = fixture as { name: string; group_name?: string; nd_code: string };
                      const displayName = f.group_name
                        ? `${f.group_name} ${f.name.charAt(0).toLowerCase()}${f.name.slice(1)}`
                        : f.name;
                      return {
                        value: key,
                        label: `${displayName} (${f.nd_code})`,
                      };
                    })}
                  />
                )}
              </div>

              <div className="form-group">
                <label>Название метода *</label>
                <Input
                  value={formData.name}
                  onChange={e => handleInputChange('name', e.target.value)}
                  placeholder="Введите название метода"
                />
              </div>

              <div className="form-group">
                <label>Тип пробы *</label>
                <Select
                  mode="multiple"
                  value={formData.sample_type}
                  onChange={value => handleInputChange('sample_type', value)}
                  options={SAMPLE_TYPE_OPTIONS}
                  placeholder="Выберите тип пробы"
                />
              </div>

              <div className="form-group">
                <label>Поля ввода данных</label>
                {(formData.input_data?.fields || []).map((field, index) => (
                  <div key={index} className="field-group">
                    <Button
                      type="text"
                      danger
                      size="small"
                      onClick={() => {
                        const fields = (formData.input_data?.fields || []).filter(
                          (_, i) => i !== index
                        );
                        handleInputChange('input_data', { fields });
                      }}
                      style={{ float: 'right', marginBottom: 8 }}
                    >
                      × Удалить
                    </Button>
                    <Input
                      placeholder="Название поля"
                      value={field.name}
                      onChange={e => {
                        const fields = [...(formData.input_data?.fields || [])];
                        fields[index] = { ...field, name: e.target.value };
                        handleInputChange('input_data', { fields });
                      }}
                      style={{ marginBottom: 8 }}
                    />
                    <Input
                      placeholder="Описание"
                      value={field.description}
                      onChange={e => {
                        const fields = [...(formData.input_data?.fields || [])];
                        fields[index] = { ...field, description: e.target.value };
                        handleInputChange('input_data', { fields });
                      }}
                      style={{ marginBottom: 8 }}
                    />
                    <Input
                      placeholder="Единица измерения"
                      value={field.unit}
                      onChange={e => {
                        const fields = [...(formData.input_data?.fields || [])];
                        fields[index] = { ...field, unit: e.target.value };
                        handleInputChange('input_data', { fields });
                      }}
                      style={{ marginBottom: 8 }}
                    />
                    <Select
                      value={field.card_index || 1}
                      onChange={value => {
                        const fields = [...(formData.input_data?.fields || [])];
                        fields[index] = { ...field, card_index: value };
                        handleInputChange('input_data', { fields });
                      }}
                      placeholder="Номер карточки"
                      style={{ width: '100%' }}
                    >
                      <Option value={1}>Карточка 1</Option>
                      <Option value={2}>Карточка 2</Option>
                      <Option value={3}>Карточка 3</Option>
                    </Select>
                  </div>
                ))}
                <Button
                  type="dashed"
                  onClick={() => {
                    const fields = [...(formData.input_data?.fields || [])];
                    fields.push({ name: '', description: '', unit: '', card_index: 1 });
                    handleInputChange('input_data', { fields });
                  }}
                  block
                >
                  + Добавить поле
                </Button>
              </div>

              {/* Промежуточные вычисления */}
              <div className="form-group">
                <label>Промежуточные вычисления</label>
                {(formData.intermediate_data?.fields || []).map((field, index) => (
                  <div key={index} className="field-group">
                    <Button
                      type="text"
                      danger
                      size="small"
                      onClick={() => {
                        const fields = (formData.intermediate_data?.fields || []).filter(
                          (_, i) => i !== index
                        );
                        handleInputChange('intermediate_data', { fields });
                      }}
                      style={{ float: 'right', marginBottom: 8 }}
                    >
                      × Удалить
                    </Button>
                    <Input
                      placeholder="Название переменной"
                      value={field.name}
                      onChange={e => {
                        const fields = [...(formData.intermediate_data?.fields || [])];
                        fields[index] = { ...field, name: e.target.value };
                        handleInputChange('intermediate_data', { fields });
                      }}
                      style={{ marginBottom: 8 }}
                    />
                    <div className="formula-input-container">
                      <Input
                        placeholder="Формула"
                        value={field.formula}
                        onChange={e => {
                          const fields = [...(formData.intermediate_data?.fields || [])];
                          fields[index] = { ...field, formula: e.target.value };
                          handleInputChange('intermediate_data', { fields });
                        }}
                        onFocus={() => setActiveFormulaField(`intermediate-${index}`)}
                        onBlur={() => {
                          setTimeout(() => setActiveFormulaField(null), 200);
                        }}
                        style={{ marginBottom: 8 }}
                      />
                      {activeFormulaField === `intermediate-${index}` && (
                        <div onMouseDown={e => e.preventDefault()}>
                          <FormulaKeyboard
                            onKeyPress={value => {
                              const fields = [...(formData.intermediate_data?.fields || [])];
                              const currentFormula = fields[index].formula || '';
                              if (value === 'backspace') {
                                fields[index] = {
                                  ...field,
                                  formula: currentFormula.slice(0, -1),
                                };
                              } else {
                                fields[index] = {
                                  ...field,
                                  formula: currentFormula + value,
                                };
                              }
                              handleInputChange('intermediate_data', { fields });
                            }}
                            variables={getAvailableVariables(index)}
                          />
                        </div>
                      )}
                    </div>
                    <Input
                      placeholder="Описание"
                      value={field.description}
                      onChange={e => {
                        const fields = [...(formData.intermediate_data?.fields || [])];
                        fields[index] = { ...field, description: e.target.value };
                        handleInputChange('intermediate_data', { fields });
                      }}
                      style={{ marginBottom: 8 }}
                    />
                    <Input
                      placeholder="Единица измерения"
                      value={field.unit}
                      onChange={e => {
                        const fields = [...(formData.intermediate_data?.fields || [])];
                        fields[index] = { ...field, unit: e.target.value };
                        handleInputChange('intermediate_data', { fields });
                      }}
                    />
                  </div>
                ))}
                <Button
                  type="dashed"
                  onClick={() => {
                    const fields = [...(formData.intermediate_data?.fields || [])];
                    fields.push({
                      name: '',
                      formula: '',
                      description: '',
                      unit: '',
                      show_calculation: true,
                    });
                    handleInputChange('intermediate_data', { fields });
                  }}
                  block
                >
                  + Добавить промежуточную переменную
                </Button>
              </div>

              <div className="form-group">
                <label>Формула расчета *</label>
                <div className="formula-input-container">
                  <Input
                    ref={formulaRef}
                    value={formData.formula}
                    onChange={e => handleInputChange('formula', e.target.value)}
                    onFocus={() => setActiveFormulaField('main')}
                    onBlur={() => {
                      setTimeout(() => setActiveFormulaField(null), 200);
                    }}
                    placeholder="Введите формулу расчета"
                  />
                  {activeFormulaField === 'main' && (
                    <div onMouseDown={e => e.preventDefault()}>
                      <FormulaKeyboard
                        onKeyPress={handleFormulaKeyPress}
                        variables={getAvailableVariables()}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Единица измерения *</label>
                <Input
                  value={formData.unit}
                  onChange={e => handleInputChange('unit', e.target.value)}
                  placeholder="Введите единицу измерения"
                />
              </div>

              <div className="form-group">
                <label>Метод измерения *</label>
                <Input
                  value={formData.measurement_method}
                  onChange={e => handleInputChange('measurement_method', e.target.value)}
                  placeholder="Введите метод измерения"
                />
              </div>

              <div className="form-group">
                <label>Шифр НД *</label>
                <Input
                  value={formData.nd_code}
                  onChange={e => handleInputChange('nd_code', e.target.value)}
                  placeholder="Введите шифр НД"
                />
              </div>

              <div className="form-group">
                <label>Наименование НД *</label>
                <Input
                  value={formData.nd_name}
                  onChange={e => handleInputChange('nd_name', e.target.value)}
                  placeholder="Введите наименование НД"
                />
              </div>

              <div className="form-group">
                <label>Погрешность измерения</label>
                <Select
                  value={formData.measurement_error?.type || 'fixed'}
                  onChange={value =>
                    handleInputChange('measurement_error', {
                      type: value,
                      value: formData.measurement_error?.value || '',
                      ranges: formData.measurement_error?.ranges || [],
                    })
                  }
                  style={{ marginBottom: 8 }}
                >
                  <Option value="fixed">Фиксированная</Option>
                  <Option value="formula">По формуле</Option>
                  <Option value="ranges">По диапазонам</Option>
                </Select>
                {formData.measurement_error?.type === 'fixed' && (
                  <Input
                    value={formData.measurement_error.value}
                    onChange={e =>
                      handleInputChange('measurement_error', {
                        type: 'fixed',
                        value: e.target.value,
                        ranges: [],
                      })
                    }
                    placeholder="Введите значение погрешности"
                  />
                )}
                {formData.measurement_error?.type === 'formula' && (
                  <div className="formula-input-container">
                    <Input
                      placeholder="Введите формулу погрешности"
                      value={formData.measurement_error.value}
                      onChange={e =>
                        handleInputChange('measurement_error', {
                          type: 'formula',
                          value: e.target.value,
                          ranges: [],
                        })
                      }
                      onFocus={() => setActiveFormulaField('error')}
                      onBlur={() => {
                        setTimeout(() => setActiveFormulaField(null), 200);
                      }}
                    />
                    {activeFormulaField === 'error' && (
                      <div onMouseDown={e => e.preventDefault()}>
                        <FormulaKeyboard
                          onKeyPress={value => {
                            const currentValue = formData.measurement_error?.value || '';
                            if (value === 'backspace') {
                              handleInputChange('measurement_error', {
                                type: 'formula',
                                value: currentValue.slice(0, -1),
                                ranges: [],
                              });
                            } else {
                              handleInputChange('measurement_error', {
                                type: 'formula',
                                value: currentValue + value,
                                ranges: [],
                              });
                            }
                          }}
                          variables={getAvailableVariables()}
                        />
                      </div>
                    )}
                  </div>
                )}
                {formData.measurement_error?.type === 'ranges' && (
                  <div>
                    {(formData.measurement_error.ranges || []).map((range, index) => (
                      <div key={index} className="field-group" style={{ marginBottom: 8 }}>
                        <Button
                          type="text"
                          danger
                          size="small"
                          onClick={() => {
                            const ranges = (formData.measurement_error?.ranges || []).filter(
                              (_, i) => i !== index
                            );
                            handleInputChange('measurement_error', {
                              type: 'ranges',
                              value: '',
                              ranges,
                            });
                          }}
                          style={{ float: 'right' }}
                        >
                          ×
                        </Button>
                        <Input
                          placeholder="Формула диапазона"
                          value={range.formula}
                          onChange={e => {
                            const ranges = [...(formData.measurement_error?.ranges || [])];
                            ranges[index] = { ...range, formula: e.target.value };
                            handleInputChange('measurement_error', {
                              type: 'ranges',
                              value: '',
                              ranges,
                            });
                          }}
                          style={{ marginBottom: 8 }}
                        />
                        <Input
                          placeholder="Значение погрешности"
                          value={range.value}
                          onChange={e => {
                            const ranges = [...(formData.measurement_error?.ranges || [])];
                            ranges[index] = { ...range, value: e.target.value };
                            handleInputChange('measurement_error', {
                              type: 'ranges',
                              value: '',
                              ranges,
                            });
                          }}
                        />
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => {
                        const ranges = [...(formData.measurement_error?.ranges || [])];
                        ranges.push({ formula: '', value: '' });
                        handleInputChange('measurement_error', {
                          type: 'ranges',
                          value: '',
                          ranges,
                        });
                      }}
                      block
                    >
                      + Добавить диапазон
                    </Button>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Округление</label>
                <Select
                  value={formData.rounding_type || 'decimal'}
                  onChange={value => handleInputChange('rounding_type', value)}
                  style={{ marginBottom: 8 }}
                >
                  <Option value="decimal">Десятичное</Option>
                  <Option value="integer">Целое</Option>
                </Select>
                {formData.rounding_type === 'decimal' && (
                  <Input
                    type="number"
                    value={formData.rounding_decimal}
                    onChange={e =>
                      handleInputChange('rounding_decimal', parseInt(e.target.value) || 0)
                    }
                    placeholder="Количество знаков после запятой"
                  />
                )}
              </div>

              {/* Условия повторяемости */}
              <div className="form-group">
                <label>Условия повторяемости</label>
                {(formData.convergence_conditions?.formulas || []).map((formula, index) => (
                  <div key={index} className="field-group">
                    <Button
                      type="text"
                      danger
                      size="small"
                      onClick={() => {
                        const formulas = (formData.convergence_conditions?.formulas || []).filter(
                          (_, i) => i !== index
                        );
                        handleInputChange('convergence_conditions', { formulas });
                      }}
                      style={{ float: 'right', marginBottom: 8 }}
                    >
                      × Удалить
                    </Button>
                    <div className="formula-input-container">
                      <Input
                        placeholder="Формула условия"
                        value={formula.formula}
                        onChange={e => {
                          const formulas = [...(formData.convergence_conditions?.formulas || [])];
                          formulas[index] = { ...formula, formula: e.target.value };
                          handleInputChange('convergence_conditions', { formulas });
                        }}
                        onFocus={() => setActiveFormulaField(`convergence-${index}`)}
                        onBlur={() => {
                          setTimeout(() => setActiveFormulaField(null), 200);
                        }}
                        style={{ marginBottom: 8 }}
                      />
                      {activeFormulaField === `convergence-${index}` && (
                        <div onMouseDown={e => e.preventDefault()}>
                          <FormulaKeyboard
                            onKeyPress={value => {
                              const formulas = [
                                ...(formData.convergence_conditions?.formulas || []),
                              ];
                              const currentFormula = formulas[index].formula || '';
                              if (value === 'backspace') {
                                formulas[index] = {
                                  ...formula,
                                  formula: currentFormula.slice(0, -1),
                                };
                              } else {
                                formulas[index] = {
                                  ...formula,
                                  formula: currentFormula + value,
                                };
                              }
                              handleInputChange('convergence_conditions', { formulas });
                            }}
                            variables={getAvailableVariables()}
                          />
                        </div>
                      )}
                    </div>
                    <Select
                      value={formula.convergence_value || 'satisfactory'}
                      onChange={value => {
                        const formulas = [...(formData.convergence_conditions?.formulas || [])];
                        formulas[index] = { ...formula, convergence_value: value };
                        handleInputChange('convergence_conditions', { formulas });
                      }}
                      placeholder="Значение сходимости"
                    >
                      <Option value="satisfactory">Удовлетворительно</Option>
                      <Option value="unsatisfactory">Неудовлетворительно</Option>
                      <Option value="absence">Отсутствие</Option>
                      <Option value="traces">Следы</Option>
                      <Option value="custom">Произвольная</Option>
                    </Select>
                  </div>
                ))}
                <Button
                  type="dashed"
                  onClick={() => {
                    const formulas = [...(formData.convergence_conditions?.formulas || [])];
                    formulas.push({ formula: '', convergence_value: 'satisfactory' });
                    handleInputChange('convergence_conditions', { formulas });
                  }}
                  block
                >
                  + Добавить условие
                </Button>
              </div>
            </div>
          </TabPane>
          <TabPane tab="Группа методов" key="group">
            <div className="form-section">
              <div className="form-group">
                <label>Название группы *</label>
                <Input
                  value={groupData.name}
                  onChange={e => setGroupData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Введите название группы"
                />
              </div>

              <div className="form-group">
                <label>Выберите методы для группы *</label>
                {availableMethodsData ? (
                  <div className="methods-checkbox-list">
                    {availableMethodsData.items
                      .filter(method => !method.is_group_member)
                      .map(method => (
                        <Checkbox
                          key={method.id}
                          checked={groupData.selectedMethods.includes(method.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setGroupData(prev => ({
                                ...prev,
                                selectedMethods: [...prev.selectedMethods, method.id],
                              }));
                            } else {
                              setGroupData(prev => ({
                                ...prev,
                                selectedMethods: prev.selectedMethods.filter(
                                  id => id !== method.id
                                ),
                              }));
                            }
                          }}
                        >
                          {method.name}
                        </Checkbox>
                      ))}
                    {availableMethodsData.items.filter(method => !method.is_group_member).length ===
                      0 && (
                      <div className="empty-methods">
                        <p>Нет доступных методов для группировки</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>Загрузка методов...</div>
                )}
              </div>
            </div>
          </TabPane>
        </Tabs>
      </div>
    </Modal>
  );
};

export default CreateResearchMethodModal;
