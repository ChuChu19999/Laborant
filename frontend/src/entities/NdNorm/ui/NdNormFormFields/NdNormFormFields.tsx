import { FormField } from '@/shared/ui/FormField';
import { InputText, Select } from '@/shared/ui/FormItems';
import { PrimarySpinIndicator, Spin } from '@/shared/ui/Spin';
import type { ResearchMethodDisplayItem } from '@/entities/ResearchMethod/@x/NdNorm';
import type { ChangeEvent } from 'react';
import './NdNormFormFields.css';

const { Option } = Select;

export interface NdNormFormValues {
  name: string;
  test_object: string | undefined;
  methodTexts: Record<number, string>;
}

interface NdNormFormFieldsProps {
  value: NdNormFormValues;
  onChange: (patch: Partial<NdNormFormValues>) => void;
  errors?: Partial<Record<'name' | 'test_object', boolean>>;
  testObjectOptions: string[];
  methods: ResearchMethodDisplayItem[];
  methodsLoading?: boolean;
}

const NdNormFormFields = ({
  value,
  onChange,
  errors = {},
  testObjectOptions,
  methods,
  methodsLoading = false,
}: NdNormFormFieldsProps) => {
  const spinnerIndicator = <PrimarySpinIndicator />;

  const handleNameChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ name: event.target.value });
  };

  const handleTestObjectChange = (next: unknown) => {
    onChange({ test_object: (next as string | undefined) || undefined });
  };

  const handleMethodTextChange = (methodId: number, text: string) => {
    onChange({
      methodTexts: {
        ...value.methodTexts,
        [methodId]: text,
      },
    });
  };

  return (
    <div className="nd-norm-form">
      <FormField
        label={
          <>
            Наименование нормы <span className="nd-norm-form-required">*</span>
          </>
        }
        itemClassName="nd-norm-form-group"
      >
        {fieldId => (
          <InputText
            id={fieldId}
            value={value.name}
            onChange={handleNameChange}
            placeholder="Введите наименование нормы"
            status={errors.name ? 'error' : ''}
            autoSize={{ minRows: 2, maxRows: 6 }}
          />
        )}
      </FormField>

      <FormField
        label={
          <>
            Объект испытаний <span className="nd-norm-form-required">*</span>
          </>
        }
        itemClassName="nd-norm-form-group"
      >
        {fieldId => (
          <Select
            id={fieldId}
            value={value.test_object}
            onChange={handleTestObjectChange}
            placeholder="Выберите объект испытаний"
            status={errors.test_object ? 'error' : ''}
            listHeight={100}
            allowClear
          >
            {testObjectOptions.map(option => (
              <Option key={option} value={option}>
                {option}
              </Option>
            ))}
          </Select>
        )}
      </FormField>

      <div className="nd-norm-form-group">
        {methodsLoading ? (
          <div className="nd-norm-form-loading">
            <Spin indicator={spinnerIndicator} tip="Загрузка методов..." spinning>
              <div className="nd-norm-form-loading-placeholder" />
            </Spin>
          </div>
        ) : methods.length === 0 ? (
          <div className="nd-norm-form-empty">Методы исследования не найдены</div>
        ) : (
          <div className="nd-norm-form-methods-list">
            {methods.map(method => (
              <FormField
                key={method.id}
                label={method.displayName}
                itemClassName="nd-norm-form-method-field"
                fieldId={`nd-norm-method-${method.id}`}
              >
                {fieldId => (
                  <InputText
                    id={fieldId}
                    value={value.methodTexts[method.id] || ''}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                      handleMethodTextChange(method.id, event.target.value)
                    }
                    placeholder="Введите норму"
                    autoSize={{ minRows: 2, maxRows: 6 }}
                  />
                )}
              </FormField>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NdNormFormFields;
