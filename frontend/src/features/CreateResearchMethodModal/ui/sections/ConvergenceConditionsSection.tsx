import { FormField } from '@/shared/ui/FormField';
import { Input, Select } from '@/shared/ui/FormItems';
import { CONVERGENCE_OPTIONS } from '../../model/constants';
import { AddFieldButton } from '../AddFieldButton';
import { FormulaInput } from '../formula/FormulaInput';
import type { ResearchMethodFormData } from '../../lib';
import type { FormulaFieldEditor } from '../../model/useFormulaFieldEditor';

const { Option } = Select;

type ConvergenceConditionsSectionProps = {
  formData: ResearchMethodFormData;
  formulaEditor: FormulaFieldEditor;
  onConvergenceChange: (index: number, field: string, value: unknown) => void;
  onAddCondition: () => void;
  onDeleteCondition: (index: number) => void;
};

export const ConvergenceConditionsSection = ({
  formData,
  formulaEditor,
  onConvergenceChange,
  onAddCondition,
  onDeleteCondition,
}: ConvergenceConditionsSectionProps) => (
  <div className="form-section">
    <h3>Условия повторяемости</h3>
    {formData.convergence_conditions.formulas.map((condition, index) => (
      <div key={condition.clientKey} className="field-group">
        <button type="button" className="delete-field-btn" onClick={() => onDeleteCondition(index)}>
          ×
        </button>
        <FormField
          label="Формула"
          itemClassName="create-research-method-form-group"
          fieldId={`convergence-${condition.clientKey}-formula`}
        >
          {fieldId => (
            <FormulaInput
              id={fieldId}
              value={condition.formula}
              onChange={e => onConvergenceChange(index, 'formula', e.target.value)}
              type="convergence"
              index={index}
              placeholder="Например: (T1-T2) <= 2"
              formulaEditor={formulaEditor}
            />
          )}
        </FormField>
        <FormField
          label="Значение повторяемости"
          itemClassName="create-research-method-form-group"
          fieldId={`convergence-${condition.clientKey}-value`}
        >
          {fieldId => (
            <Select
              id={fieldId}
              value={condition.convergence_value}
              onChange={value => onConvergenceChange(index, 'convergence_value', value)}
              placeholder="Выберите значение повторяемости"
              virtual={false}
            >
              {CONVERGENCE_OPTIONS.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          )}
        </FormField>
        {condition.convergence_value === 'custom' && (
          <FormField
            label="Произвольное значение"
            itemClassName="create-research-method-form-group"
            fieldId={`convergence-${condition.clientKey}-custom`}
          >
            {fieldId => (
              <Input
                id={fieldId}
                value={condition.custom_value || ''}
                onChange={e => onConvergenceChange(index, 'custom_value', e.target.value)}
                placeholder="Введите текст, который будет показан как результат"
                required
              />
            )}
          </FormField>
        )}
      </div>
    ))}
    <div
      className={
        formData.convergence_conditions.formulas.length === 0 ? 'empty-fields-container' : undefined
      }
    >
      <AddFieldButton onClick={onAddCondition}>Добавить условие повторяемости</AddFieldButton>
    </div>
  </div>
);
