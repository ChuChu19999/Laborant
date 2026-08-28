import { UserPicker, type Employee } from '@/entities/Employee/@x/Protocol';
import { Checkbox } from '@/shared/ui/Checkbox';
import { FormField } from '@/shared/ui/FormField';
import { DatePicker, Input, Select } from '@/shared/ui/FormItems';
import type { Sample } from '@/entities/Sample/@x/Protocol';
import type { Dayjs } from 'dayjs';
import type { ChangeEvent } from 'react';
import './ProtocolFormFields.css';

const { Option } = Select;

const ISSUED_POSITION_OPTIONS = [
  { value: 'Ведущий инженер-химик', label: 'Ведущий инженер-химик' },
  { value: 'Инженер-химик 1 категории', label: 'Инженер-химик 1 категории' },
  { value: 'Инженер-химик 2 категории', label: 'Инженер-химик 2 категории' },
];

const APPROVED_POSITION_OPTIONS = [
  { value: 'Начальник лаборатории', label: 'Начальник лаборатории' },
  { value: 'И.о. начальника лаборатории', label: 'И.о. начальника лаборатории' },
  { value: 'Начальник отдела', label: 'Начальник отдела' },
  { value: 'Зам. начальника отдела', label: 'Зам. начальника отдела' },
];

export interface ProtocolFormValues {
  test_protocol_number: string;
  test_protocol_date: Dayjs | null;
  is_accredited: boolean;
  sampling_act_number: string;
  issued: Employee | null;
  approved: Employee | null;
  issued_position: string | undefined;
  approved_position: string | undefined;
  protocol_template_id: number | undefined;
  samples: number[];
}

export interface ProtocolTemplateOption {
  id: number;
  name: string;
  version: string;
  deleted_at?: string | null;
  isCurrent: boolean;
}

interface ProtocolFormFieldsProps {
  value: ProtocolFormValues;
  onChange: <K extends keyof ProtocolFormValues>(field: K, value: ProtocolFormValues[K]) => void;
  errors?: Partial<Record<keyof ProtocolFormValues, boolean>>;
  laboratoryName: string;
  templates: ProtocolTemplateOption[];
  templatesLoading?: boolean;
  samples: Sample[];
  samplesLoading?: boolean;
}

const ProtocolFormFields = ({
  value,
  onChange,
  errors = {},
  laboratoryName,
  templates,
  templatesLoading = false,
  samples,
  samplesLoading = false,
}: ProtocolFormFieldsProps) => {
  const handleInputChange =
    (field: 'test_protocol_number' | 'sampling_act_number') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(field, event.target.value);
    };

  return (
    <div className="protocol-form">
      <FormField label="Номер протокола испытаний" itemClassName="protocol-form-group">
        {fieldId => (
          <Input
            id={fieldId}
            value={value.test_protocol_number}
            onChange={handleInputChange('test_protocol_number')}
            placeholder="Введите номер протокола испытаний"
          />
        )}
      </FormField>

      <FormField label="Дата протокола испытаний" itemClassName="protocol-form-group">
        {fieldId => (
          <DatePicker
            id={fieldId}
            value={value.test_protocol_date}
            onChange={date => onChange('test_protocol_date', (date as Dayjs | null) || null)}
            placeholder="ДД.ММ.ГГГГ"
            format="DD.MM.YYYY"
          />
        )}
      </FormField>

      <div className="protocol-form-group">
        <Checkbox
          className="protocol-form-checkbox"
          checked={value.is_accredited}
          onChange={event => onChange('is_accredited', event.target.checked)}
        >
          Аккредитован
        </Checkbox>
      </div>

      <FormField
        label={
          <>
            Номер акта отбора <span className="protocol-form-required">*</span>
          </>
        }
        itemClassName="protocol-form-group"
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.sampling_act_number}
            onChange={handleInputChange('sampling_act_number')}
            placeholder="Введите номер акта отбора"
            status={errors.sampling_act_number ? 'error' : ''}
          />
        )}
      </FormField>

      <FormField label="Протокол оформил" itemClassName="protocol-form-group">
        {fieldId => (
          <UserPicker
            id={fieldId}
            value={value.issued}
            onChange={employee => onChange('issued', employee)}
            placeholder="Введите ФИО лица, оформившего протокол"
            laboratoryName={laboratoryName}
          />
        )}
      </FormField>

      <FormField label="Должность оформившего" itemClassName="protocol-form-group">
        {fieldId => (
          <Select
            id={fieldId}
            value={value.issued_position}
            onChange={next =>
              onChange('issued_position', (next as string | undefined) || undefined)
            }
            placeholder="Выберите должность оформившего"
            allowClear
          >
            {ISSUED_POSITION_OPTIONS.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField label="Протокол утвердил" itemClassName="protocol-form-group">
        {fieldId => (
          <UserPicker
            id={fieldId}
            value={value.approved}
            onChange={employee => onChange('approved', employee)}
            placeholder="Введите ФИО лица, утвердившего протокол"
            laboratoryName={laboratoryName}
          />
        )}
      </FormField>

      <FormField label="Должность утвердившего" itemClassName="protocol-form-group">
        {fieldId => (
          <Select
            id={fieldId}
            value={value.approved_position}
            onChange={next =>
              onChange('approved_position', (next as string | undefined) || undefined)
            }
            placeholder="Выберите должность утвердившего"
            allowClear
          >
            {APPROVED_POSITION_OPTIONS.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField label="Шаблон протокола" itemClassName="protocol-form-group">
        {fieldId => (
          <Select
            id={fieldId}
            value={value.protocol_template_id}
            onChange={next =>
              onChange('protocol_template_id', (next as number | undefined) || undefined)
            }
            placeholder="Выберите шаблон протокола"
            loading={templatesLoading}
            allowClear
          >
            {templates.map(template => {
              const isDeleted = !!template.deleted_at;
              return (
                <Option
                  key={template.id}
                  value={template.id}
                  disabled={isDeleted}
                  className={isDeleted ? 'template-option-deleted' : ''}
                >
                  <span className={isDeleted ? 'template-name-deleted' : ''}>
                    {template.name} - {template.version}
                  </span>
                  {template.isCurrent && !isDeleted ? (
                    <span className="template-current-badge"> (Актуальный)</span>
                  ) : null}
                  {isDeleted ? <span className="template-deleted-badge"> (Устаревший)</span> : null}
                </Option>
              );
            })}
          </Select>
        )}
      </FormField>

      <FormField label="Пробы" itemClassName="protocol-form-group">
        {fieldId => (
          <Select
            id={fieldId}
            mode="multiple"
            value={value.samples}
            onChange={next => onChange('samples', (next as number[]) || [])}
            placeholder="Выберите пробы"
            loading={samplesLoading}
            allowClear
            showSearch
            filterOption={(input, option) => {
              const sample = samples.find(item => item.id === option?.value);
              return sample
                ? sample.registration_number.toLowerCase().includes(input.toLowerCase())
                : false;
            }}
            listHeight={200}
          >
            {samples.map(sample => (
              <Option key={sample.id} value={sample.id}>
                {sample.registration_number} - {sample.test_object}
              </Option>
            ))}
          </Select>
        )}
      </FormField>
    </div>
  );
};

export default ProtocolFormFields;
