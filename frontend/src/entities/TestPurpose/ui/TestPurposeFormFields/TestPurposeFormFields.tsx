import { FormField } from '@/shared/ui/FormField';
import { Input } from '@/shared/ui/FormItems';
import './TestPurposeFormFields.css';
import type { ChangeEvent } from 'react';

export interface TestPurposeFormValues {
  name: string;
}

interface TestPurposeFormFieldsProps {
  value: TestPurposeFormValues;
  onChange: (field: keyof TestPurposeFormValues, value: string) => void;
  errors?: Partial<Record<keyof TestPurposeFormValues | 'general', string>>;
}

const TestPurposeFormFields = ({ value, onChange, errors = {} }: TestPurposeFormFieldsProps) => {
  const handleChange =
    (field: keyof TestPurposeFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      onChange(field, event.target.value);
    };

  return (
    <div className="test-purpose-form">
      {errors.general ? <div className="test-purpose-form-error">{errors.general}</div> : null}
      <FormField
        label={
          <>
            Название цели испытаний <span className="test-purpose-form-required">*</span>
          </>
        }
        labelClassName="test-purpose-form-label"
        itemClassName="test-purpose-form-item"
        error={
          errors.name ? <div className="test-purpose-form-error">{errors.name}</div> : undefined
        }
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.name}
            onChange={handleChange('name')}
            placeholder="Введите название цели испытаний"
            status={errors.name ? 'error' : ''}
            required
          />
        )}
      </FormField>
    </div>
  );
};

export default TestPurposeFormFields;
