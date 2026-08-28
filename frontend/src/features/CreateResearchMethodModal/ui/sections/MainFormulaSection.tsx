import { FormField } from '@/shared/ui/FormField';
import { FormulaInput } from '../formula/FormulaInput';
import type { FormulaFieldEditor } from '../../model/useFormulaFieldEditor';
import type { ChangeEvent } from 'react';

type MainFormulaSectionProps = {
  formula: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  formulaEditor: FormulaFieldEditor;
};

export const MainFormulaSection = ({
  formula,
  onChange,
  formulaEditor,
}: MainFormulaSectionProps) => (
  <FormField
    label="Формула расчёта результата"
    itemClassName="create-research-method-form-group"
    fieldId="main-formula"
  >
    {fieldId => (
      <FormulaInput
        id={fieldId}
        value={formula}
        onChange={onChange}
        type="main"
        index={null}
        placeholder="Введите формулу расчёта"
        formulaEditor={formulaEditor}
      />
    )}
  </FormField>
);
