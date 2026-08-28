import { FormField } from '@/shared/ui/FormField';
import { Input } from '@/shared/ui/FormItems';
import type { ChangeEvent } from 'react';
import './DepartmentFormFields.css';

export interface DepartmentFormValues {
  name: string;
  laboratory_location: string;
}

interface DepartmentFormFieldsProps {
  value: DepartmentFormValues;
  onChange: (field: keyof DepartmentFormValues, value: string) => void;
  errors?: Partial<Record<keyof DepartmentFormValues | 'general', string>>;
}

const DepartmentFormFields = ({ value, onChange, errors = {} }: DepartmentFormFieldsProps) => {
  const handleChange =
    (field: keyof DepartmentFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      onChange(field, event.target.value);
    };

  return (
    <div className="department-form">
      {errors.general ? <div className="department-form-error">{errors.general}</div> : null}
      <FormField
        label={
          <>
            Название подразделения <span className="department-form-required">*</span>
          </>
        }
        labelClassName="department-form-label"
        itemClassName="department-form-item"
        error={errors.name ? <div className="department-form-error">{errors.name}</div> : undefined}
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.name}
            onChange={handleChange('name')}
            placeholder="Введите название подразделения"
            status={errors.name ? 'error' : ''}
            required
          />
        )}
      </FormField>
      <FormField
        label={
          <>
            Место осуществления лабораторной деятельности{' '}
            <span className="department-form-required">*</span>
          </>
        }
        labelClassName="department-form-label"
        itemClassName="department-form-item"
        error={
          errors.laboratory_location ? (
            <div className="department-form-error">{errors.laboratory_location}</div>
          ) : undefined
        }
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.laboratory_location}
            onChange={handleChange('laboratory_location')}
            placeholder="Введите место осуществления"
            status={errors.laboratory_location ? 'error' : ''}
            required
          />
        )}
      </FormField>
    </div>
  );
};

export default DepartmentFormFields;
