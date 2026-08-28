import { FormulaKeyboard } from '@/entities/Calculation';
import { Checkbox } from '@/shared/ui/Checkbox';
import { FormField } from '@/shared/ui/FormField';
import { Input, RadioGroup, Select } from '@/shared/ui/FormItems';
import { applyFormulaKeyPress, createClientKey } from '../../lib';
import { FormulaInput } from '../formula/FormulaInput';
import type { IntermediateFieldForm } from '../../lib';
import type { FormulaFieldEditor } from '../../model/useFormulaFieldEditor';
import type { InputRef } from '@/shared/ui/FormItems';
import type { KeyboardEvent } from 'react';

const { Option } = Select;

type IntermediateFieldItemProps = {
  field: IntermediateFieldForm;
  index: number;
  formulaEditor: FormulaFieldEditor;
  onIntermediateDataChange: (index: number, field: string, value: unknown) => void;
  onDeleteField: (index: number) => void;
  onRangeChange: (fieldIndex: number, rangeIndex: number, key: string, value: string) => void;
  onAddRange: (fieldIndex: number) => void;
  onDeleteRange: (fieldIndex: number, rangeIndex: number) => void;
  getRoundingMode: (field: IntermediateFieldForm) => 'result' | 'custom' | 'multiple';
  onRoundingModeChange: (index: number, mode: 'result' | 'custom' | 'multiple') => void;
};

export const IntermediateFieldItem = ({
  field,
  index,
  formulaEditor,
  onIntermediateDataChange,
  onDeleteField,
  onRangeChange,
  onAddRange,
  onDeleteRange,
  getRoundingMode,
  onRoundingModeChange,
}: IntermediateFieldItemProps) => {
  const {
    activeFormulaField,
    setActiveFormulaField,
    formulaRefs,
    handleFormulaKeyPress,
    getAvailableVariables,
  } = formulaEditor;

  const formulaKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      ((e.ctrlKey || e.metaKey) && ['c', 'v', 'a', 'x'].includes(e.key.toLowerCase()))
    ) {
      return;
    }
    e.preventDefault();
  };

  const assignRangeRef = (rangeIndex: number, key: string, el: InputRef | null) => {
    if (!formulaRefs.intermediate.current[index]) {
      formulaRefs.intermediate.current[index] = {};
    }
    if (!formulaRefs.intermediate.current[index][rangeIndex]) {
      formulaRefs.intermediate.current[index][rangeIndex] = {};
    }
    if (formulaRefs.intermediate.current[index][rangeIndex]) {
      formulaRefs.intermediate.current[index][rangeIndex][key] = el;
    }
  };

  const assignThresholdRef = (key: string, el: InputRef | null) => {
    if (!formulaRefs.threshold[index]) {
      formulaRefs.threshold[index] = {};
    }
    formulaRefs.threshold[index][key] = el;
  };

  const fieldKey = field.clientKey;

  return (
    <div className="field-group">
      <button type="button" className="delete-field-btn" onClick={() => onDeleteField(index)}>
        ×
      </button>
      <FormField
        label="Переменная"
        itemClassName="create-research-method-form-group"
        fieldId={`intermediate-${fieldKey}-name`}
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={field.name}
            onChange={e => onIntermediateDataChange(index, 'name', e.target.value)}
            placeholder="Введите переменную"
          />
        )}
      </FormField>

      <div className="field-stack">
        <div className="range-header">
          <Checkbox
            className="create-research-method-checkbox"
            checked={!!field.range_calculation}
            onChange={e => {
              if (e.target.checked) {
                onIntermediateDataChange(index, 'range_calculation', {
                  ranges: [{ clientKey: createClientKey(), condition: '', formula: '' }],
                });
                onIntermediateDataChange(index, 'formula', '');
                onIntermediateDataChange(index, 'use_threshold_table', false);
              } else {
                onIntermediateDataChange(index, 'range_calculation', null);
              }
            }}
          >
            Использовать диапазонный расчёт
          </Checkbox>
        </div>

        {!field.range_calculation && !field.use_threshold_table && (
          <FormField
            label="Формула"
            itemClassName="create-research-method-form-group"
            fieldId={`intermediate-${fieldKey}-formula`}
          >
            {fieldId => (
              <FormulaInput
                id={fieldId}
                value={field.formula}
                onChange={e => onIntermediateDataChange(index, 'formula', e.target.value)}
                type="intermediate"
                index={index}
                formulaEditor={formulaEditor}
              />
            )}
          </FormField>
        )}

        {field.range_calculation && (
          <div className="field-stack">
            {field.range_calculation.ranges.map((range, rangeIndex) => (
              <div key={range.clientKey} className="range-item">
                <button
                  type="button"
                  className="delete-range-btn"
                  onClick={() => onDeleteRange(index, rangeIndex)}
                >
                  ×
                </button>
                <FormField
                  label="Условие"
                  itemClassName="create-research-method-form-group"
                  fieldId={`intermediate-${fieldKey}-range-${range.clientKey}-condition`}
                >
                  {fieldId => (
                    <div className="formula-input-container">
                      <Input
                        id={fieldId}
                        value={range.condition}
                        onChange={e =>
                          onRangeChange(index, rangeIndex, 'condition', e.target.value)
                        }
                        onFocus={() =>
                          setActiveFormulaField(`intermediate-${index}-${rangeIndex}-condition`)
                        }
                        onBlur={() => {
                          setTimeout(() => {
                            setActiveFormulaField(null);
                          }, 200);
                        }}
                        onKeyDown={formulaKeyDown}
                        ref={el => assignRangeRef(rangeIndex, 'condition', el)}
                        placeholder="Введите условие"
                      />
                      {activeFormulaField === `intermediate-${index}-${rangeIndex}-condition` && (
                        <div onMouseDown={e => e.preventDefault()}>
                          <FormulaKeyboard
                            onKeyPress={handleFormulaKeyPress}
                            variables={getAvailableVariables('intermediate', index)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </FormField>
                <FormField
                  label="Формула"
                  itemClassName="create-research-method-form-group"
                  fieldId={`intermediate-${fieldKey}-range-${range.clientKey}-formula`}
                >
                  {fieldId => (
                    <div className="formula-input-container">
                      <Input
                        id={fieldId}
                        value={range.formula}
                        onChange={e => onRangeChange(index, rangeIndex, 'formula', e.target.value)}
                        onFocus={() =>
                          setActiveFormulaField(`intermediate-${index}-${rangeIndex}-formula`)
                        }
                        onBlur={() => {
                          setTimeout(() => {
                            setActiveFormulaField(null);
                          }, 200);
                        }}
                        onKeyDown={formulaKeyDown}
                        ref={el => assignRangeRef(rangeIndex, 'formula', el)}
                        placeholder="Введите формулу расчёта"
                      />
                      {activeFormulaField === `intermediate-${index}-${rangeIndex}-formula` && (
                        <div onMouseDown={e => e.preventDefault()}>
                          <FormulaKeyboard
                            onKeyPress={handleFormulaKeyPress}
                            variables={getAvailableVariables('intermediate', index)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </FormField>
              </div>
            ))}
            <button type="button" onClick={() => onAddRange(index)} className="add-range-btn">
              + Добавить диапазон
            </button>
          </div>
        )}
      </div>

      <FormField
        label="Описание"
        itemClassName="create-research-method-form-group"
        fieldId={`intermediate-${fieldKey}-description`}
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={field.description}
            onChange={e => onIntermediateDataChange(index, 'description', e.target.value)}
            placeholder="Введите описание"
          />
        )}
      </FormField>
      <FormField
        label="Единица измерения"
        itemClassName="create-research-method-form-group"
        fieldId={`intermediate-${fieldKey}-unit`}
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={field.unit || ''}
            onChange={e => onIntermediateDataChange(index, 'unit', e.target.value)}
            placeholder="Введите единицу измерения"
          />
        )}
      </FormField>
      {!field.use_threshold_table && (
        <div className="intermediate-rounding-section">
          <div className="intermediate-rounding-title">Округление</div>
          <RadioGroup
            className="intermediate-rounding-modes"
            value={getRoundingMode(field)}
            onChange={e =>
              onRoundingModeChange(index, e.target.value as 'result' | 'custom' | 'multiple')
            }
            options={[
              { value: 'result', label: 'Как у результата' },
              { value: 'custom', label: 'Задать своё' },
              {
                value: 'multiple',
                label: 'Округлять до ближайшего кратного',
              },
            ]}
          />
          {getRoundingMode(field) === 'custom' && (
            <div className="intermediate-rounding-nested">
              <FormField
                label="Тип округления"
                itemClassName="create-research-method-form-group"
                fieldId={`intermediate-${fieldKey}-rounding-type`}
              >
                {fieldId => (
                  <Select
                    id={fieldId}
                    value={field.rounding_type ?? 'decimal'}
                    onChange={value => onIntermediateDataChange(index, 'rounding_type', value)}
                    placeholder="Выберите тип округления"
                    virtual={false}
                  >
                    <Option value="decimal">До десятичного знака</Option>
                    <Option value="significant">До значащих цифр</Option>
                  </Select>
                )}
              </FormField>
              <FormField
                label="Количество знаков"
                itemClassName="create-research-method-form-group"
                fieldId={`intermediate-${fieldKey}-rounding-decimal`}
              >
                {fieldId => (
                  <Input
                    id={fieldId}
                    type="number"
                    value={field.rounding_decimal ?? 0}
                    onChange={e =>
                      onIntermediateDataChange(
                        index,
                        'rounding_decimal',
                        parseInt(e.target.value, 10) || 0
                      )
                    }
                    min={0}
                    placeholder="Количество знаков"
                  />
                )}
              </FormField>
            </div>
          )}
          {getRoundingMode(field) === 'multiple' && (
            <div className="intermediate-rounding-nested">
              <FormField
                label="Значение кратности"
                itemClassName="create-research-method-form-group"
                fieldId={`intermediate-${fieldKey}-multiple-value`}
              >
                {fieldId => (
                  <Input
                    id={fieldId}
                    type="number"
                    value={field.multiple_value || ''}
                    onChange={e =>
                      onIntermediateDataChange(index, 'multiple_value', e.target.value)
                    }
                    placeholder="Например: 10"
                    min="0"
                  />
                )}
              </FormField>
            </div>
          )}
        </div>
      )}
      <div className="field-stack">
        <Checkbox
          className="create-research-method-checkbox"
          checked={field.use_threshold_table || false}
          onChange={e => {
            onIntermediateDataChange(index, 'use_threshold_table', e.target.checked);
            if (e.target.checked) {
              onIntermediateDataChange(index, 'formula', '');
              onIntermediateDataChange(index, 'range_calculation', null);
              onIntermediateDataChange(index, 'threshold_table_values', {
                target_variable: '',
                higher_variable: '',
                lower_variable: '',
              });
            }
          }}
        >
          Использовать метод ближайших табличных значений
        </Checkbox>
        {field.use_threshold_table && (
          <div className="create-research-method-form-group-spacing">
            <FormField
              label="Переменная для определения направления округления"
              itemClassName="create-research-method-form-group"
              fieldId={`intermediate-${fieldKey}-threshold-target`}
            >
              {fieldId => (
                <div className="formula-input-container">
                  <Input
                    id={fieldId}
                    value={field.threshold_table_values?.target_variable || ''}
                    onChange={e =>
                      onIntermediateDataChange(index, 'threshold_table_values', {
                        ...field.threshold_table_values,
                        target_variable: e.target.value,
                      })
                    }
                    onFocus={() => setActiveFormulaField(`threshold-target-${index}`)}
                    onBlur={() => {
                      setTimeout(() => {
                        setActiveFormulaField(null);
                      }, 200);
                    }}
                    onKeyDown={formulaKeyDown}
                    ref={el => assignThresholdRef('target', el)}
                    placeholder="Введите переменную (например: p)"
                  />
                  {activeFormulaField === `threshold-target-${index}` && (
                    <div onMouseDown={e => e.preventDefault()}>
                      <FormulaKeyboard
                        onKeyPress={value => {
                          const inputRef = formulaRefs.threshold[index]?.target;
                          if (!inputRef?.input) return;
                          applyFormulaKeyPress(inputRef.input, value, newValue => {
                            onIntermediateDataChange(index, 'threshold_table_values', {
                              ...field.threshold_table_values,
                              target_variable: newValue,
                            });
                          });
                        }}
                        variables={getAvailableVariables('intermediate', index)}
                      />
                    </div>
                  )}
                </div>
              )}
            </FormField>
            <FormField
              label="Переменная для значения при округлении вверх"
              itemClassName="create-research-method-form-group"
              fieldId={`intermediate-${fieldKey}-threshold-higher`}
            >
              {fieldId => (
                <div className="formula-input-container">
                  <Input
                    id={fieldId}
                    value={field.threshold_table_values?.higher_variable || ''}
                    onChange={e =>
                      onIntermediateDataChange(index, 'threshold_table_values', {
                        ...field.threshold_table_values,
                        higher_variable: e.target.value,
                      })
                    }
                    onFocus={() => setActiveFormulaField(`threshold-higher-${index}`)}
                    onBlur={() => {
                      setTimeout(() => {
                        setActiveFormulaField(null);
                      }, 200);
                    }}
                    onKeyDown={formulaKeyDown}
                    ref={el => assignThresholdRef('higher', el)}
                    placeholder="Введите переменную (например: pтабл_при_tнаиб)"
                  />
                  {activeFormulaField === `threshold-higher-${index}` && (
                    <div onMouseDown={e => e.preventDefault()}>
                      <FormulaKeyboard
                        onKeyPress={value => {
                          const inputRef = formulaRefs.threshold[index]?.higher;
                          if (!inputRef?.input) return;
                          applyFormulaKeyPress(inputRef.input, value, newValue => {
                            onIntermediateDataChange(index, 'threshold_table_values', {
                              ...field.threshold_table_values,
                              higher_variable: newValue,
                            });
                          });
                        }}
                        variables={getAvailableVariables('intermediate', index)}
                      />
                    </div>
                  )}
                </div>
              )}
            </FormField>
            <FormField
              label="Переменная для значения при округлении вниз"
              itemClassName="create-research-method-form-group"
              fieldId={`intermediate-${fieldKey}-threshold-lower`}
            >
              {fieldId => (
                <div className="formula-input-container">
                  <Input
                    id={fieldId}
                    value={field.threshold_table_values?.lower_variable || ''}
                    onChange={e =>
                      onIntermediateDataChange(index, 'threshold_table_values', {
                        ...field.threshold_table_values,
                        lower_variable: e.target.value,
                      })
                    }
                    onFocus={() => setActiveFormulaField(`threshold-lower-${index}`)}
                    onBlur={() => {
                      setTimeout(() => {
                        setActiveFormulaField(null);
                      }, 200);
                    }}
                    onKeyDown={formulaKeyDown}
                    ref={el => assignThresholdRef('lower', el)}
                    placeholder="Введите переменную (например: pтабл_при_tнаим)"
                  />
                  {activeFormulaField === `threshold-lower-${index}` && (
                    <div onMouseDown={e => e.preventDefault()}>
                      <FormulaKeyboard
                        onKeyPress={value => {
                          const inputRef = formulaRefs.threshold[index]?.lower;
                          if (!inputRef?.input) return;
                          applyFormulaKeyPress(inputRef.input, value, newValue => {
                            onIntermediateDataChange(index, 'threshold_table_values', {
                              ...field.threshold_table_values,
                              lower_variable: newValue,
                            });
                          });
                        }}
                        variables={getAvailableVariables('intermediate', index)}
                      />
                    </div>
                  )}
                </div>
              )}
            </FormField>
          </div>
        )}
      </div>
      <Checkbox
        className="create-research-method-checkbox"
        checked={field.show_calculation}
        onChange={e => onIntermediateDataChange(index, 'show_calculation', e.target.checked)}
      >
        Показывать расчёт
      </Checkbox>
    </div>
  );
};
