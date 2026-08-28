import { FormField } from '@/shared/ui/FormField';
import { Input } from '@/shared/ui/FormItems';
import './SamplingLocationFormFields.css';
import type { ChangeEvent } from 'react';

export interface SamplingLocationFormValues {
  name: string;
}

interface SamplingLocationFormFieldsProps {
  value: SamplingLocationFormValues;
  onChange: (field: keyof SamplingLocationFormValues, value: string) => void;
  errors?: Partial<Record<keyof SamplingLocationFormValues | 'general', string>>;
}

const SamplingLocationFormFields = ({
  value,
  onChange,
  errors = {},
}: SamplingLocationFormFieldsProps) => {
  const handleChange =
    (field: keyof SamplingLocationFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      onChange(field, event.target.value);
    };

  return (
    <div className="sampling-location-form">
      {errors.general ? <div className="sampling-location-form-error">{errors.general}</div> : null}
      <FormField
        label={
          <>
            Название места отбора пробы <span className="sampling-location-form-required">*</span>
          </>
        }
        labelClassName="sampling-location-form-label"
        itemClassName="sampling-location-form-item"
        error={
          errors.name ? (
            <div className="sampling-location-form-error">{errors.name}</div>
          ) : undefined
        }
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.name}
            onChange={handleChange('name')}
            placeholder="Введите название места отбора пробы"
            status={errors.name ? 'error' : ''}
            required
          />
        )}
      </FormField>
    </div>
  );
};

export default SamplingLocationFormFields;
