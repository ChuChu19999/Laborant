import { FormField } from '@/shared/ui/FormField';
import { Input } from '@/shared/ui/FormItems';
import './SampleTypeFormFields.css';
import type { ChangeEvent } from 'react';

export interface SampleTypeFormValues {
  name: string;
}

interface SampleTypeFormFieldsProps {
  value: SampleTypeFormValues;
  onChange: (field: keyof SampleTypeFormValues, value: string) => void;
  errors?: Partial<Record<keyof SampleTypeFormValues | 'general', string>>;
}

const SampleTypeFormFields = ({ value, onChange, errors = {} }: SampleTypeFormFieldsProps) => {
  const handleChange =
    (field: keyof SampleTypeFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      onChange(field, event.target.value);
    };

  return (
    <div className="sample-type-form">
      {errors.general ? <div className="sample-type-form-error">{errors.general}</div> : null}
      <FormField
        label={
          <>
            Название типа пробы <span className="sample-type-form-required">*</span>
          </>
        }
        labelClassName="sample-type-form-label"
        itemClassName="sample-type-form-item"
        error={
          errors.name ? <div className="sample-type-form-error">{errors.name}</div> : undefined
        }
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.name}
            onChange={handleChange('name')}
            placeholder="Введите название типа пробы"
            status={errors.name ? 'error' : ''}
            required
          />
        )}
      </FormField>
    </div>
  );
};

export default SampleTypeFormFields;
