import { FormField } from '@/shared/ui/FormField';
import { Input, Select } from '@/shared/ui/FormItems';
import { AddFieldButton } from '../AddFieldButton';
import type { ResearchMethodFormData } from '../../lib';

const { Option } = Select;

type InputDataFieldsSectionProps = {
  formData: ResearchMethodFormData;
  onInputDataChange: (index: number, field: string, value: unknown) => void;
  onDeleteField: (index: number) => void;
  onAddField: () => void;
};

export const InputDataFieldsSection = ({
  formData,
  onInputDataChange,
  onDeleteField,
  onAddField,
}: InputDataFieldsSectionProps) => (
  <div className="form-section">
    <h3>Поля ввода данных</h3>
    {formData.input_data.fields.map((field, index) => (
      <div key={field.clientKey} className="field-group">
        <button type="button" className="delete-field-btn" onClick={() => onDeleteField(index)}>
          ×
        </button>
        <FormField
          label="Переменная"
          itemClassName="create-research-method-form-group"
          fieldId={`input-data-${field.clientKey}-name`}
        >
          {fieldId => (
            <Input
              id={fieldId}
              value={field.name}
              onChange={e => onInputDataChange(index, 'name', e.target.value)}
              placeholder="Введите переменную"
            />
          )}
        </FormField>
        <FormField
          label="Описание"
          itemClassName="create-research-method-form-group"
          fieldId={`input-data-${field.clientKey}-description`}
        >
          {fieldId => (
            <Input
              id={fieldId}
              value={field.description}
              onChange={e => onInputDataChange(index, 'description', e.target.value)}
              placeholder="Введите описание"
            />
          )}
        </FormField>
        <FormField
          label="Единица измерения"
          itemClassName="create-research-method-form-group"
          fieldId={`input-data-${field.clientKey}-unit`}
        >
          {fieldId => (
            <Input
              id={fieldId}
              value={field.unit || ''}
              onChange={e => onInputDataChange(index, 'unit', e.target.value)}
              placeholder="Введите единицу измерения"
            />
          )}
        </FormField>
        <FormField
          label="Номер карточки"
          itemClassName="create-research-method-form-group"
          fieldId={`input-data-${field.clientKey}-card-index`}
        >
          {fieldId => (
            <Select
              id={fieldId}
              value={field.card_index}
              onChange={value => onInputDataChange(index, 'card_index', value)}
              placeholder="Выберите номер карточки"
              listHeight={100}
            >
              <Option value={1}>Карточка 1</Option>
              <Option value={2}>Карточка 2</Option>
              <Option value={3}>Карточка 3</Option>
              <Option value={4}>Карточка 4</Option>
              <Option value={5}>Карточка 5</Option>
              <Option value={6}>Карточка 6</Option>
              <Option value={7}>Карточка 7</Option>
              <Option value={8}>Карточка 8</Option>
            </Select>
          )}
        </FormField>
      </div>
    ))}
    <AddFieldButton onClick={onAddField}>Добавить переменную</AddFieldButton>
  </div>
);
