import { UserPicker, type Employee } from '@/entities/Employee/@x/Sample';
import {
  SelectionConditionsForm,
  type SelectionConditionsField,
} from '@/entities/SelectionCondition/@x/Sample';
import { FormField } from '@/shared/ui/FormField';
import { DatePicker, Input, Select } from '@/shared/ui/FormItems';
import type { Dayjs } from 'dayjs';
import type { ChangeEvent } from 'react';
import './SampleFormFields.css';

const { Option } = Select;

export interface SampleFormValues {
  registration_number: string;
  sample_type: string | undefined;
  test_object: string | undefined;
  sampling_date: Dayjs | null;
  receiving_date: Dayjs | null;
  branch_id: number | undefined;
  sampling_location_id: number | undefined;
  well: string;
  mode: string | undefined;
  indicators_count: number | undefined;
}

export interface SampleFormSelectOption {
  value: number | string;
  label: string;
}

interface SampleFormFieldsProps {
  value: SampleFormValues;
  onChange: (patch: Partial<SampleFormValues>) => void;
  errors?: Partial<Record<keyof SampleFormValues | 'added_by', boolean>>;
  canShow: (field: string) => boolean;
  terminologyLabel: string;
  sampleTypes: string[];
  testObjectOptions: string[];
  branchOptions: SampleFormSelectOption[];
  branchesLoading?: boolean;
  samplingLocationOptions: SampleFormSelectOption[];
  locationsLoading?: boolean;
  wellModeOptions: SampleFormSelectOption[];
  wellModesLoading?: boolean;
  addedBy: Employee | null;
  onAddedByChange?: (employee: Employee | null) => void;
  addedByDisabled?: boolean;
  laboratoryName?: string;
  selectionConditionsFields?: SelectionConditionsField[];
  selectionConditions?: Record<string, string>;
  onSelectionConditionChange?: (field: string, value: string) => void;
}

const SampleFormFields = ({
  value,
  onChange,
  errors = {},
  canShow,
  terminologyLabel,
  sampleTypes,
  testObjectOptions,
  branchOptions,
  branchesLoading = false,
  samplingLocationOptions,
  locationsLoading = false,
  wellModeOptions,
  wellModesLoading = false,
  addedBy,
  onAddedByChange,
  addedByDisabled = false,
  laboratoryName = '',
  selectionConditionsFields = [],
  selectionConditions = {},
  onSelectionConditionChange,
}: SampleFormFieldsProps) => {
  const handleInputChange =
    (field: 'registration_number' | 'well') => (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ [field]: event.target.value });
    };

  const handleIndicatorsCountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (raw === '') {
      onChange({ indicators_count: undefined });
      return;
    }
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 0) {
      onChange({ indicators_count: parsed });
    }
  };

  const handleSelectChange =
    (field: 'sample_type' | 'test_object' | 'branch_id' | 'sampling_location_id' | 'mode') =>
    (next: unknown) => {
      if (field === 'branch_id') {
        onChange({
          branch_id: (next as number | undefined) || undefined,
          sampling_location_id: undefined,
          mode: undefined,
        });
        return;
      }
      onChange({ [field]: (next as string | number | undefined) || undefined });
    };

  return (
    <div className="sample-form">
      <FormField
        label={
          <>
            Регистрационный номер <span className="sample-form-required">*</span>
          </>
        }
        itemClassName="sample-form-group"
      >
        {fieldId => (
          <Input
            id={fieldId}
            value={value.registration_number}
            onChange={handleInputChange('registration_number')}
            placeholder="Введите регистрационный номер"
            status={errors.registration_number ? 'error' : ''}
          />
        )}
      </FormField>

      {canShow('sample_type') ? (
        <FormField label="Тип пробы" itemClassName="sample-form-group">
          {fieldId => (
            <Select
              id={fieldId}
              value={value.sample_type}
              onChange={handleSelectChange('sample_type')}
              placeholder="Выберите тип пробы"
              allowClear
            >
              {sampleTypes.map(type => (
                <Option key={type} value={type}>
                  {type}
                </Option>
              ))}
            </Select>
          )}
        </FormField>
      ) : null}

      <FormField
        label={
          <>
            Объект испытаний <span className="sample-form-required">*</span>
          </>
        }
        itemClassName="sample-form-group"
      >
        {fieldId => (
          <Select
            id={fieldId}
            value={value.test_object}
            onChange={handleSelectChange('test_object')}
            placeholder="Выберите объект испытаний"
            status={errors.test_object ? 'error' : ''}
            showSearch
            optionFilterProp="children"
          >
            {testObjectOptions.map(name => (
              <Option key={name} value={name}>
                {name}
              </Option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField
        label={
          <>
            Количество показателей <span className="sample-form-required">*</span>
          </>
        }
        itemClassName="sample-form-group"
      >
        {fieldId => (
          <Input
            id={fieldId}
            type="number"
            min={0}
            step={1}
            value={value.indicators_count ?? ''}
            onChange={handleIndicatorsCountChange}
            placeholder="Введите количество показателей"
            status={errors.indicators_count ? 'error' : ''}
          />
        )}
      </FormField>

      {canShow('branch') ? (
        <FormField label="Филиал" itemClassName="sample-form-group">
          {fieldId => (
            <Select
              id={fieldId}
              value={value.branch_id}
              onChange={handleSelectChange('branch_id')}
              placeholder="Выберите филиал"
              loading={branchesLoading}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {branchOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          )}
        </FormField>
      ) : null}

      {canShow('sampling_location') ? (
        <FormField label="Место отбора" itemClassName="sample-form-group">
          {fieldId => (
            <Select
              id={fieldId}
              value={value.sampling_location_id}
              onChange={handleSelectChange('sampling_location_id')}
              placeholder="Выберите место отбора"
              loading={locationsLoading}
              disabled={!value.branch_id}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {samplingLocationOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          )}
        </FormField>
      ) : null}

      {canShow('well') ? (
        <FormField label="Скважина" itemClassName="sample-form-group">
          {fieldId => (
            <Input
              id={fieldId}
              value={value.well}
              onChange={handleInputChange('well')}
              placeholder="Введите номер скважины"
            />
          )}
        </FormField>
      ) : null}

      {canShow('well_mode') ? (
        <FormField label={terminologyLabel} itemClassName="sample-form-group">
          {fieldId => (
            <Select
              id={fieldId}
              value={value.mode}
              onChange={handleSelectChange('mode')}
              placeholder={`Выберите ${terminologyLabel.toLowerCase()}`}
              loading={wellModesLoading}
              disabled={!value.branch_id}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {wellModeOptions.map(option => (
                <Option key={option.value} value={option.label}>
                  {option.label}
                </Option>
              ))}
            </Select>
          )}
        </FormField>
      ) : null}

      {canShow('sampling_date') ? (
        <FormField label="Дата отбора пробы" itemClassName="sample-form-group">
          {fieldId => (
            <DatePicker
              id={fieldId}
              format="DD.MM.YYYY"
              value={value.sampling_date}
              onChange={date => onChange({ sampling_date: (date as Dayjs | null) || null })}
              placeholder="ДД.ММ.ГГГГ"
              className="custom-date-picker"
              rootClassName="custom-date-picker-root"
              classNames={{ popup: { root: 'custom-date-picker-popup' } }}
              inputReadOnly={false}
              allowClear={true}
            />
          )}
        </FormField>
      ) : null}

      {canShow('receipt_date') ? (
        <FormField label="Дата получения пробы" itemClassName="sample-form-group">
          {fieldId => (
            <DatePicker
              id={fieldId}
              format="DD.MM.YYYY"
              value={value.receiving_date}
              onChange={date => onChange({ receiving_date: (date as Dayjs | null) || null })}
              placeholder="ДД.ММ.ГГГГ"
              className="custom-date-picker"
              rootClassName="custom-date-picker-root"
              classNames={{ popup: { root: 'custom-date-picker-popup' } }}
              inputReadOnly={false}
              allowClear={true}
            />
          )}
        </FormField>
      ) : null}

      <FormField
        label={
          <>
            Добавил пробу <span className="sample-form-required">*</span>
          </>
        }
        itemClassName="sample-form-group"
      >
        {fieldId => (
          <UserPicker
            id={fieldId}
            value={addedBy}
            onChange={employee => onAddedByChange?.(employee)}
            placeholder={
              addedByDisabled
                ? 'ФИО лица, добавившего пробу'
                : 'Введите ФИО лица, добавившего пробу'
            }
            laboratoryName={laboratoryName}
            disabled={addedByDisabled}
            allowClear={!addedByDisabled}
            error={errors.added_by ? 'Поле обязательно для заполнения' : undefined}
          />
        )}
      </FormField>

      {selectionConditionsFields.length > 0 && onSelectionConditionChange ? (
        <SelectionConditionsForm
          conditions={selectionConditionsFields}
          values={selectionConditions}
          onChange={onSelectionConditionChange}
        />
      ) : null}
    </div>
  );
};

export default SampleFormFields;
