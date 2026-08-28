import { FormField } from '@/shared/ui/FormField';
import { Input } from '@/shared/ui/FormItems';
import './WellModeFormFields.css';
import type { ChangeEvent } from 'react';

export interface WellModeFormValues {
  name: string;
}

interface WellModeFormFieldsProps {
  value: WellModeFormValues;
  onChange: (field: keyof WellModeFormValues, value: string) => void;
  errors?: Partial<Record<keyof WellModeFormValues | 'general', string>>;
}

const WellModeFormFields = ({ value, onChange, errors = {} }: WellModeFormFieldsProps) => {
  const handleChange =
    (field: keyof WellModeFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      onChange(field, event.target.value);
    };

  return (
    <div className="well-mode-form">
      {errors.general ? <div className="well-mode-form-error">{errors.general}</div> : null}
      <FormField
        label={
          <>
            Название режима скважины <span className="well-mode-form-required">*</span>
          </>
        }
        labelClassName="well-mode-form-label"
        itemClassName="well-mode-form-item"
        error={errors.name ? <div className="well-mode-form-error">{errors.name}</div> : undefined}
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.name}
            onChange={handleChange('name')}
            placeholder="Введите название режима скважины"
            status={errors.name ? 'error' : ''}
            required
          />
        )}
      </FormField>
    </div>
  );
};

export default WellModeFormFields;
