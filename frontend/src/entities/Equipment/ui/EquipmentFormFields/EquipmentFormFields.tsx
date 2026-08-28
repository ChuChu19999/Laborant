import { Checkbox } from '@/shared/ui/Checkbox';
import { FormField } from '@/shared/ui/FormField';
import { DatePicker, Input, Select } from '@/shared/ui/FormItems';
import { Spin } from '@/shared/ui/Spin';
import type { EquipmentMethodOption } from '../../lib/equipmentMethodOptions';
import type { Dayjs } from 'dayjs';
import type { ChangeEvent } from 'react';
import './EquipmentFormFields.css';

const { Option } = Select;

const EQUIPMENT_TYPE_OPTIONS = [
  { value: 'measuring_instrument', label: 'Средство измерения' },
  { value: 'test_equipment', label: 'Испытательное оборудование' },
];

export interface EquipmentFormValues {
  type: string | undefined;
  name: string;
  serial_number: string;
  verification_info: string;
  verification_date: Dayjs | null;
  verification_end_date: Dayjs | null;
  method_ids: number[];
}

interface EquipmentFormFieldsProps {
  value: EquipmentFormValues;
  onChange: <K extends keyof EquipmentFormValues>(field: K, value: EquipmentFormValues[K]) => void;
  errors?: Partial<Record<keyof EquipmentFormValues, boolean>>;
  methods: EquipmentMethodOption[];
  methodsLoading?: boolean;
}

const EquipmentFormFields = ({
  value,
  onChange,
  errors = {},
  methods,
  methodsLoading = false,
}: EquipmentFormFieldsProps) => {
  const handleInputChange =
    (field: 'name' | 'serial_number' | 'verification_info') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(field, event.target.value);
    };

  const handleMethodToggle = (methodId: number, checked: boolean) => {
    if (checked) {
      onChange('method_ids', [...value.method_ids, methodId]);
      return;
    }
    onChange(
      'method_ids',
      value.method_ids.filter(id => id !== methodId)
    );
  };

  return (
    <div className="equipment-form">
      <FormField
        label={
          <>
            Тип <span className="equipment-form-required">*</span>
          </>
        }
        itemClassName="equipment-form-group"
      >
        {fieldId => (
          <Select
            id={fieldId}
            value={value.type}
            onChange={next => onChange('type', (next as string | undefined) || undefined)}
            placeholder="Выберите тип прибора"
            status={errors.type ? 'error' : ''}
            allowClear
          >
            {EQUIPMENT_TYPE_OPTIONS.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField
        label={
          <>
            Наименование <span className="equipment-form-required">*</span>
          </>
        }
        itemClassName="equipment-form-group"
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.name}
            onChange={handleInputChange('name')}
            placeholder="Введите наименование прибора"
            status={errors.name ? 'error' : ''}
          />
        )}
      </FormField>

      <FormField
        label={
          <>
            Заводской номер <span className="equipment-form-required">*</span>
          </>
        }
        itemClassName="equipment-form-group"
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.serial_number}
            onChange={handleInputChange('serial_number')}
            placeholder="Введите заводской номер"
            status={errors.serial_number ? 'error' : ''}
          />
        )}
      </FormField>

      <FormField
        label={
          <>
            Сведения о результатах поверки <span className="equipment-form-required">*</span>
          </>
        }
        itemClassName="equipment-form-group"
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.verification_info}
            onChange={handleInputChange('verification_info')}
            placeholder="Введите сведения о результатах поверки"
            status={errors.verification_info ? 'error' : ''}
          />
        )}
      </FormField>

      <FormField
        label={
          <>
            Дата поверки <span className="equipment-form-required">*</span>
          </>
        }
        itemClassName="equipment-form-group"
      >
        {fieldId => (
          <DatePicker
            id={fieldId}
            value={value.verification_date}
            onChange={date => onChange('verification_date', (date as Dayjs | null) || null)}
            placeholder="ДД.ММ.ГГГГ"
            format="DD.MM.YYYY"
            status={errors.verification_date ? 'error' : ''}
          />
        )}
      </FormField>

      <FormField
        label={
          <>
            Дата окончания поверки <span className="equipment-form-required">*</span>
          </>
        }
        itemClassName="equipment-form-group"
      >
        {fieldId => (
          <DatePicker
            id={fieldId}
            value={value.verification_end_date}
            onChange={date => onChange('verification_end_date', (date as Dayjs | null) || null)}
            placeholder="ДД.ММ.ГГГГ"
            format="DD.MM.YYYY"
            status={errors.verification_end_date ? 'error' : ''}
          />
        )}
      </FormField>

      <FormField
        label="Выберите методы, которым будет доступен этот прибор"
        labelMode="group"
        itemClassName="equipment-form-group"
      >
        {(_fieldId, labelId) => (
          <div aria-labelledby={labelId}>
            {methodsLoading ? (
              <div className="equipment-methods-loading">
                <Spin tip="Загрузка методов..." spinning>
                  <div className="equipment-methods-loading-placeholder" />
                </Spin>
              </div>
            ) : (
              <div className="equipment-methods-list">
                {methods.map(method => (
                  <Checkbox
                    key={method.id}
                    checked={value.method_ids.includes(method.id)}
                    onChange={event => handleMethodToggle(method.id, event.target.checked)}
                    className="equipment-method-checkbox"
                  >
                    {method.displayName}
                  </Checkbox>
                ))}
              </div>
            )}
          </div>
        )}
      </FormField>
    </div>
  );
};

export default EquipmentFormFields;
