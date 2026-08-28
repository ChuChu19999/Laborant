import { FormField } from '@/shared/ui/FormField';
import { Input } from '@/shared/ui/FormItems';
import type { ChangeEvent } from 'react';
import './LaboratoryFormFields.css';

export interface LaboratoryFormValues {
  name: string;
  full_name: string;
  laboratory_location: string;
}

interface LaboratoryFormFieldsProps {
  value: LaboratoryFormValues;
  onChange: (field: keyof LaboratoryFormValues, value: string) => void;
  errors?: Partial<Record<keyof LaboratoryFormValues | 'general', string>>;
}

const LaboratoryFormFields = ({ value, onChange, errors = {} }: LaboratoryFormFieldsProps) => {
  const handleChange =
    (field: keyof LaboratoryFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      onChange(field, event.target.value);
    };

  return (
    <div className="laboratory-form">
      {errors.general ? <div className="laboratory-form-error">{errors.general}</div> : null}
      <FormField
        label={
          <>
            Аббревиатура <span className="laboratory-form-required">*</span>
          </>
        }
        labelClassName="laboratory-form-label"
        itemClassName="laboratory-form-item"
        error={errors.name ? <div className="laboratory-form-error">{errors.name}</div> : undefined}
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.name}
            onChange={handleChange('name')}
            placeholder="Введите аббревиатуру"
            status={errors.name ? 'error' : ''}
            required
          />
        )}
      </FormField>
      <FormField
        label={
          <>
            Полное название <span className="laboratory-form-required">*</span>
          </>
        }
        labelClassName="laboratory-form-label"
        itemClassName="laboratory-form-item"
        error={
          errors.full_name ? (
            <div className="laboratory-form-error">{errors.full_name}</div>
          ) : undefined
        }
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.full_name}
            onChange={handleChange('full_name')}
            placeholder="Введите полное название"
            status={errors.full_name ? 'error' : ''}
            required
          />
        )}
      </FormField>
      <FormField
        label="Место осуществления лабораторной деятельности"
        labelClassName="laboratory-form-label"
        itemClassName="laboratory-form-item"
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.laboratory_location}
            onChange={handleChange('laboratory_location')}
            placeholder="Введите место осуществления (необязательно)"
          />
        )}
      </FormField>
    </div>
  );
};

export default LaboratoryFormFields;
