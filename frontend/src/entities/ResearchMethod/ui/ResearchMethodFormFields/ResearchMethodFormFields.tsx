import { useId, type ChangeEvent } from 'react';
import { Checkbox } from '@/shared/ui/Checkbox';
import { FormField } from '@/shared/ui/FormField';
import { Input } from '@/shared/ui/FormItems';
import { Spin } from '@/shared/ui/Spin';
import './ResearchMethodFormFields.css';

export interface ResearchMethodIdentityFormValues {
  name: string;
  sample_type: string[];
  unit: string;
  measurement_method: string;
  nd_code: string;
  nd_name: string;
}

interface ResearchMethodFormFieldsProps {
  value: ResearchMethodIdentityFormValues;
  onChange: (patch: Partial<ResearchMethodIdentityFormValues>) => void;
  sampleTypeOptions: { value: string; label: string }[];
  sampleTypesLoading?: boolean;
  sections?: ('name' | 'catalog' | 'sample_type')[];
  errors?: Partial<Record<keyof ResearchMethodIdentityFormValues, boolean>>;
}

/** Базовые поля карточки метода исследования (без редактора формул). */
const ResearchMethodFormFields = ({
  value,
  onChange,
  sampleTypeOptions,
  sampleTypesLoading = false,
  sections = ['name', 'catalog', 'sample_type'],
  errors = {},
}: ResearchMethodFormFieldsProps) => {
  const showName = sections.includes('name');
  const showCatalog = sections.includes('catalog');
  const showSampleType = sections.includes('sample_type');
  const sampleTypesLabelId = useId();

  const handleTextChange =
    (field: 'name' | 'unit' | 'measurement_method' | 'nd_code' | 'nd_name') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ [field]: event.target.value });
    };

  const handleSampleTypeToggle = (tag: string, checked: boolean) => {
    if (checked) {
      onChange({ sample_type: [...value.sample_type, tag] });
      return;
    }
    onChange({ sample_type: value.sample_type.filter(type => type !== tag) });
  };

  return (
    <div className="research-method-form-fields">
      {showName ? (
        <FormField
          label={
            <>
              Название метода <span className="research-method-form-required">*</span>
            </>
          }
          itemClassName="research-method-form-group"
        >
          {fieldId => (
            <Input
              id={fieldId}
              name="name"
              value={value.name}
              onChange={handleTextChange('name')}
              placeholder="Введите название формулы"
              status={errors.name ? 'error' : ''}
            />
          )}
        </FormField>
      ) : null}

      {showCatalog ? (
        <>
          <FormField
            label={
              <>
                Единица измерения <span className="research-method-form-required">*</span>
              </>
            }
            itemClassName="research-method-form-group"
          >
            {fieldId => (
              <Input
                id={fieldId}
                name="unit"
                value={value.unit}
                onChange={handleTextChange('unit')}
                placeholder="Введите единицу измерения"
                status={errors.unit ? 'error' : ''}
                required
              />
            )}
          </FormField>

          <FormField
            label={
              <>
                Метод измерения <span className="research-method-form-required">*</span>
              </>
            }
            itemClassName="research-method-form-group"
          >
            {fieldId => (
              <Input
                id={fieldId}
                name="measurement_method"
                value={value.measurement_method}
                onChange={handleTextChange('measurement_method')}
                placeholder="Введите метод измерения"
                status={errors.measurement_method ? 'error' : ''}
                required
              />
            )}
          </FormField>

          <FormField
            label={
              <>
                Шифр НД <span className="research-method-form-required">*</span>
              </>
            }
            itemClassName="research-method-form-group"
          >
            {fieldId => (
              <Input
                id={fieldId}
                name="nd_code"
                value={value.nd_code}
                onChange={handleTextChange('nd_code')}
                placeholder="Введите шифр НД"
                status={errors.nd_code ? 'error' : ''}
                required
              />
            )}
          </FormField>

          <FormField
            label={
              <>
                Наименование НД <span className="research-method-form-required">*</span>
              </>
            }
            itemClassName="research-method-form-group"
          >
            {fieldId => (
              <Input
                id={fieldId}
                name="nd_name"
                value={value.nd_name}
                onChange={handleTextChange('nd_name')}
                placeholder="Введите наименование НД"
                status={errors.nd_name ? 'error' : ''}
                required
              />
            )}
          </FormField>
        </>
      ) : null}

      {showSampleType ? (
        <div className="research-method-form-group research-method-form-sample-types-field">
          <div className="research-method-form-sample-types-header">
            <span id={sampleTypesLabelId} className="research-method-form-sample-types-label">
              Тип пробы <span className="research-method-form-required">*</span>
            </span>
            {!sampleTypesLoading && sampleTypeOptions.length > 0 ? (
              <span className="research-method-form-sample-types-actions">
                <button
                  type="button"
                  className="research-method-form-sample-types-action"
                  onClick={() =>
                    onChange({
                      sample_type: sampleTypeOptions.map(option => option.value),
                    })
                  }
                >
                  Выбрать все
                </button>
                <span className="research-method-form-sample-types-action-separator" aria-hidden>
                  |
                </span>
                <button
                  type="button"
                  className="research-method-form-sample-types-action"
                  onClick={() => onChange({ sample_type: [] })}
                >
                  Очистить
                </button>
              </span>
            ) : null}
          </div>

          {sampleTypesLoading ? (
            <div className="research-method-form-sample-types-panel">
              <Spin />
            </div>
          ) : sampleTypeOptions.length === 0 ? (
            <p className="research-method-form-hint">
              Нет объектов испытаний в справочнике для выбранной лаборатории.
            </p>
          ) : (
            <div
              className="research-method-form-sample-types-panel"
              role="group"
              aria-labelledby={sampleTypesLabelId}
            >
              {sampleTypeOptions.map(option => (
                <Checkbox
                  key={option.value}
                  checked={value.sample_type.includes(option.value)}
                  onChange={event => handleSampleTypeToggle(option.value, event.target.checked)}
                >
                  {option.label}
                </Checkbox>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default ResearchMethodFormFields;
