import { toDisplayString } from '@/shared/lib/formatting';
import { type FormInstance } from '@/shared/ui/Form';
import { FormItem } from '@/shared/ui/FormItem';
import { Select } from '@/shared/ui/FormItems';
import { CircleHelpIcon } from '@/shared/ui/icons';
import { Tooltip } from '@/shared/ui/Tooltip';
import './ParallelCard/ParallelCard.css';

const { Option } = Select;

const COLOR_OPTIONS = ['', 'б/цв', 'св-желт', 'жел', 'т-жел', 'св-кор', 'корич', 'т-кор'];

interface MassFractionOilColorFieldProps {
  methodId: number;
  fieldName: string;
  fieldDescription?: string;
  formValues: Record<string, string | number | undefined>;
  form: FormInstance;
  setFormValues: (
    values:
      | Record<string, string | number | undefined>
      | ((
          prev: Record<string, string | number | undefined>
        ) => Record<string, string | number | undefined>)
  ) => void;
  disabled?: boolean;
}

const MassFractionOilColorField = ({
  methodId,
  fieldName,
  fieldDescription,
  formValues,
  form,
  setFormValues,
  disabled = false,
}: MassFractionOilColorFieldProps) => {
  const fieldKey = `${methodId}_${fieldName}`;

  return (
    <div className="parallel-card">
      <FormItem
        title={
          <div className="parallel-card-title-wrapper">
            <span className="parallel-card-title-text">{fieldName}</span>
            <Tooltip title={fieldDescription || ''} placement="right">
              <CircleHelpIcon size={16} className="parallel-card-title-icon animated-icon" />
            </Tooltip>
          </div>
        }
        name={fieldKey}
      >
        <Select
          value={
            formValues[fieldKey] !== undefined && formValues[fieldKey] !== null
              ? formValues[fieldKey]
              : ''
          }
          onChange={value => {
            const normalizedValue: string | number | undefined =
              value !== undefined && value !== null && typeof value !== 'object'
                ? typeof value === 'string' || typeof value === 'number'
                  ? value
                  : toDisplayString(value)
                : '';
            form.setFieldValue(fieldKey, normalizedValue);
            setFormValues(prev => ({
              ...prev,
              [fieldKey]: normalizedValue,
            }));
          }}
          placeholder="Выберите цвет"
          allowClear={false}
          className="parallel-card-select"
          disabled={disabled}
        >
          {COLOR_OPTIONS.map(option => (
            <Option key={option === '' ? 'empty' : option} value={option || ''}>
              {option === '' ? 'Не указано' : option}
            </Option>
          ))}
        </Select>
      </FormItem>
    </div>
  );
};

export default MassFractionOilColorField;
