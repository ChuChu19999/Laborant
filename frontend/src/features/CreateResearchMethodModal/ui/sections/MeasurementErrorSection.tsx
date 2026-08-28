import { FormField } from '@/shared/ui/FormField';
import { Input, Select } from '@/shared/ui/FormItems';
import { FormulaInput } from '../formula/FormulaInput';
import type { ResearchMethodFormData } from '../../lib';
import type { FormulaFieldEditor } from '../../model/useFormulaFieldEditor';
import type { ChangeEvent } from 'react';

const { Option } = Select;

type MeasurementErrorSectionProps = {
  formData: ResearchMethodFormData;
  formulaEditor: FormulaFieldEditor;
  onTypeChange: (type: 'fixed' | 'formula' | 'range' | 'none') => void;
  onValueChange: (value: string | ChangeEvent<HTMLInputElement>) => void;
};

export const MeasurementErrorSection = ({
  formData,
  formulaEditor,
  onTypeChange,
  onValueChange,
}: MeasurementErrorSectionProps) => (
  <>
    <FormField
      label="Погрешность измерения"
      itemClassName="create-research-method-form-group"
      fieldId="measurement-error-type"
    >
      {fieldId => (
        <Select
          id={fieldId}
          value={formData.measurement_error.type}
          onChange={value => {
            if (value === 'fixed' || value === 'formula' || value === 'range' || value === 'none') {
              onTypeChange(value);
            }
          }}
          placeholder="Выберите тип погрешности"
          virtual={false}
        >
          <Option value="none">Нет</Option>
          <Option value="fixed">Фиксированное число</Option>
          <Option value="formula">По формуле</Option>
        </Select>
      )}
    </FormField>

    {formData.measurement_error.type !== 'range' && formData.measurement_error.type !== 'none' && (
      <FormField
        label={
          formData.measurement_error.type === 'fixed'
            ? 'Значение погрешности'
            : 'Формула погрешности'
        }
        itemClassName="create-research-method-form-group"
        fieldId="measurement-error-value"
      >
        {fieldId =>
          formData.measurement_error.type === 'formula' ? (
            <FormulaInput
              id={fieldId}
              value={formData.measurement_error.value}
              onChange={e => onValueChange(e)}
              type="error"
              index={null}
              placeholder="Введите формулу для расчёта погрешности"
              formulaEditor={formulaEditor}
            />
          ) : (
            <Input
              id={fieldId}
              value={formData.measurement_error.value}
              onChange={e => onValueChange(e.target.value)}
              placeholder="Введите числовое значение"
              required
            />
          )
        }
      </FormField>
    )}
  </>
);
