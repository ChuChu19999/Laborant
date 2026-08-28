import { AddFieldButton } from '../AddFieldButton';
import { IntermediateFieldItem } from './IntermediateFieldItem';
import type { IntermediateFieldForm, ResearchMethodFormData } from '../../lib';
import type { FormulaFieldEditor } from '../../model/useFormulaFieldEditor';

type IntermediateFieldsSectionProps = {
  formData: ResearchMethodFormData;
  formulaEditor: FormulaFieldEditor;
  onIntermediateDataChange: (index: number, field: string, value: unknown) => void;
  onDeleteField: (index: number) => void;
  onAddField: () => void;
  onRangeChange: (fieldIndex: number, rangeIndex: number, key: string, value: string) => void;
  onAddRange: (fieldIndex: number) => void;
  onDeleteRange: (fieldIndex: number, rangeIndex: number) => void;
  getRoundingMode: (field: IntermediateFieldForm) => 'result' | 'custom' | 'multiple';
  onRoundingModeChange: (index: number, mode: 'result' | 'custom' | 'multiple') => void;
};

export const IntermediateFieldsSection = ({
  formData,
  formulaEditor,
  onIntermediateDataChange,
  onDeleteField,
  onAddField,
  onRangeChange,
  onAddRange,
  onDeleteRange,
  getRoundingMode,
  onRoundingModeChange,
}: IntermediateFieldsSectionProps) => (
  <div className="form-section">
    <h3>Промежуточные вычисления</h3>
    {formData.intermediate_data.fields.map((field, index) => (
      <IntermediateFieldItem
        key={field.clientKey}
        field={field}
        index={index}
        formulaEditor={formulaEditor}
        onIntermediateDataChange={onIntermediateDataChange}
        onDeleteField={onDeleteField}
        onRangeChange={onRangeChange}
        onAddRange={onAddRange}
        onDeleteRange={onDeleteRange}
        getRoundingMode={getRoundingMode}
        onRoundingModeChange={onRoundingModeChange}
      />
    ))}
    <div
      className={
        formData.intermediate_data.fields.length === 0 ? 'empty-fields-container' : undefined
      }
    >
      <AddFieldButton onClick={onAddField}>Добавить промежуточную переменную</AddFieldButton>
    </div>
  </div>
);
