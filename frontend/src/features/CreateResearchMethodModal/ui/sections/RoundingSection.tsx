import { FormField } from '@/shared/ui/FormField';
import { Input, Select } from '@/shared/ui/FormItems';
import type { ResearchMethodFormData } from '../../lib';
import type { ChangeEvent } from 'react';

const { Option } = Select;

type RoundingSectionProps = {
  formData: ResearchMethodFormData;
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
};

export const RoundingSection = ({ formData, onInputChange }: RoundingSectionProps) => (
  <>
    <FormField
      label="Округление"
      itemClassName="create-research-method-form-group"
      fieldId="rounding-type"
    >
      {fieldId => (
        <Select
          id={fieldId}
          value={formData.rounding_type}
          onChange={value => {
            const e = {
              target: { name: 'rounding_type', value },
            } as ChangeEvent<HTMLInputElement>;
            onInputChange(e);
          }}
          placeholder="Выберите тип округления"
          virtual={false}
        >
          <Option value="decimal">До десятичного знака</Option>
          <Option value="significant">До значащих цифр</Option>
        </Select>
      )}
    </FormField>

    <FormField
      label="Количество знаков"
      itemClassName="create-research-method-form-group"
      fieldId="rounding-decimal"
    >
      {fieldId => (
        <Input
          id={fieldId}
          type="number"
          name="rounding_decimal"
          value={formData.rounding_decimal}
          onChange={onInputChange}
          required
          min="0"
          placeholder="Количество знаков"
        />
      )}
    </FormField>
  </>
);
