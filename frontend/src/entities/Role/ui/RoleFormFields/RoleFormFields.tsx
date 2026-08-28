import { FormField } from '@/shared/ui/FormField';
import { Input, Select } from '@/shared/ui/FormItems';
import { ROLE_TYPE_OPTIONS } from '../../lib/roleTypeOptions';
import './RoleFormFields.css';
import type { RoleTypeValue } from '../../api/roles';
import type { ChangeEvent } from 'react';

export interface RoleFormValues {
  name: string;
  role_type: RoleTypeValue | undefined;
}

interface RoleFormFieldsProps {
  value: RoleFormValues;
  onChange: <K extends keyof RoleFormValues>(field: K, value: RoleFormValues[K]) => void;
  errors?: Partial<Record<keyof RoleFormValues, boolean>>;
}

const RoleFormFields = ({ value, onChange, errors = {} }: RoleFormFieldsProps) => {
  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange('name', event.target.value);
  };

  const handleRoleTypeChange = (selected: unknown) => {
    onChange('role_type', selected as RoleTypeValue);
  };

  return (
    <div className="role-form">
      <FormField
        label={
          <>
            Роль <span className="required">*</span>
          </>
        }
        itemClassName="form-group"
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.name}
            onChange={handleNameChange}
            placeholder="Введите наименование роли"
            status={errors.name ? 'error' : ''}
          />
        )}
      </FormField>

      <FormField
        label={
          <>
            Тип роли <span className="required">*</span>
          </>
        }
        itemClassName="form-group"
      >
        {fieldId => (
          <Select
            id={fieldId}
            value={value.role_type}
            onChange={handleRoleTypeChange}
            placeholder="Выберите тип роли"
            options={ROLE_TYPE_OPTIONS}
            status={errors.role_type ? 'error' : ''}
          />
        )}
      </FormField>
    </div>
  );
};

export default RoleFormFields;
