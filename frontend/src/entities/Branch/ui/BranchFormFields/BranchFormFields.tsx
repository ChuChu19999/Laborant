import { FormField } from '@/shared/ui/FormField';
import { Input } from '@/shared/ui/FormItems';
import './BranchFormFields.css';
import type { ChangeEvent } from 'react';

export interface BranchFormValues {
  name: string;
  phone: string;
}

interface BranchFormFieldsProps {
  value: BranchFormValues;
  onChange: (field: keyof BranchFormValues, value: string) => void;
  errors?: Partial<Record<keyof BranchFormValues | 'general', string>>;
}

const BranchFormFields = ({ value, onChange, errors = {} }: BranchFormFieldsProps) => {
  const handleChange =
    (field: keyof BranchFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      onChange(field, event.target.value);
    };

  return (
    <div className="branch-form">
      {errors.general ? <div className="branch-form-error">{errors.general}</div> : null}
      <FormField
        label={
          <>
            Название филиала <span className="branch-form-required">*</span>
          </>
        }
        labelClassName="branch-form-label"
        itemClassName="branch-form-item"
        error={errors.name ? <div className="branch-form-error">{errors.name}</div> : undefined}
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.name}
            onChange={handleChange('name')}
            placeholder="Введите название филиала"
            status={errors.name ? 'error' : ''}
            required
          />
        )}
      </FormField>
      <FormField
        label="Номер телефона"
        labelClassName="branch-form-label"
        itemClassName="branch-form-item"
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.phone}
            onChange={handleChange('phone')}
            placeholder="Введите номер телефона (необязательно)"
          />
        )}
      </FormField>
    </div>
  );
};

export default BranchFormFields;
