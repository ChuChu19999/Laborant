import { VisibilityScopeForm } from '@/entities/Laboratory/@x/TestObject';
import { FormField } from '@/shared/ui/FormField';
import { Input } from '@/shared/ui/FormItems';
import type { VisibilityScope } from '@/entities/Role/@x/TestObject';
import type { ChangeEvent } from 'react';
import './TestObjectFormFields.css';

export interface TestObjectFormValues {
  name: string;
  tag: string;
  protocol_abbreviation: string;
  visibility_scope: VisibilityScope;
}

interface TestObjectFormFieldsProps {
  value: TestObjectFormValues;
  onChange: (patch: Partial<TestObjectFormValues>) => void;
  errors?: Partial<Record<'name' | 'tag', boolean>>;
}

const TestObjectFormFields = ({ value, onChange, errors = {} }: TestObjectFormFieldsProps) => {
  const handleInputChange =
    (field: 'name' | 'tag' | 'protocol_abbreviation') => (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ [field]: event.target.value });
    };

  return (
    <div className="test-object-form">
      <FormField
        label={
          <>
            Наименование <span className="test-object-form-required">*</span>
          </>
        }
        itemClassName="test-object-form-group"
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.name}
            onChange={handleInputChange('name')}
            placeholder="Введите наименование"
            status={errors.name ? 'error' : ''}
          />
        )}
      </FormField>

      <FormField
        label={
          <>
            Тег <span className="test-object-form-required">*</span>
          </>
        }
        itemClassName="test-object-form-group"
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.tag}
            onChange={handleInputChange('tag')}
            placeholder="Например: oil, condensate, oil_calibration"
            status={errors.tag ? 'error' : ''}
          />
        )}
      </FormField>

      <FormField label="Аббревиатура для протокола" itemClassName="test-object-form-group">
        {fieldId => (
          <Input
            id={fieldId}
            value={value.protocol_abbreviation}
            onChange={handleInputChange('protocol_abbreviation')}
            placeholder="Например: н, дк, нкс"
            maxLength={8}
          />
        )}
      </FormField>

      <FormField label="Область видимости" itemClassName="test-object-form-group" labelMode="group">
        {(_fieldId, labelId) => (
          <div aria-labelledby={labelId}>
            <VisibilityScopeForm
              value={value.visibility_scope}
              onChange={visibility_scope => onChange({ visibility_scope })}
            />
          </div>
        )}
      </FormField>
    </div>
  );
};

export default TestObjectFormFields;
