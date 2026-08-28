import { FormulaKeyboard } from '@/entities/Calculation';
import { Input } from '@/shared/ui/FormItems';
import type { FormulaFieldEditor } from '../../model/useFormulaFieldEditor';
import type { ChangeEvent } from 'react';

type FormulaInputProps = {
  id?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  type: string;
  index?: number | null;
  placeholder?: string;
  formulaEditor: FormulaFieldEditor;
};

export const FormulaInput = ({
  id,
  value,
  onChange,
  type,
  index = null,
  placeholder = '',
  formulaEditor,
}: FormulaInputProps) => {
  const {
    activeFormulaField,
    setActiveFormulaField,
    formulaRefs,
    handleFormulaKeyPress,
    getAvailableVariables,
  } = formulaEditor;

  return (
    <div className="formula-input-container">
      <Input
        id={id}
        value={value}
        onChange={onChange}
        onFocus={() => setActiveFormulaField(`${type}-${index ?? 'main'}`)}
        onBlur={() => {
          setTimeout(() => {
            setActiveFormulaField(null);
          }, 200);
        }}
        onKeyDown={e => {
          if (
            e.key === 'Backspace' ||
            e.key === 'Delete' ||
            e.key === 'ArrowLeft' ||
            e.key === 'ArrowRight' ||
            ((e.ctrlKey || e.metaKey) && ['c', 'v', 'a', 'x'].includes(e.key.toLowerCase()))
          ) {
            return;
          }
          e.preventDefault();
        }}
        ref={el => {
          if (type === 'main') formulaRefs.main.current = el;
          else if (type === 'convergence' && index !== null)
            formulaRefs.convergence.current[index] = el;
          else if (type === 'intermediate' && index !== null) {
            if (!formulaRefs.intermediate.current[index]) {
              formulaRefs.intermediate.current[index] = {};
            }
            const indexRefs = formulaRefs.intermediate.current[index];
            if (!indexRefs) {
              return;
            }
            if (!indexRefs[-1]) {
              indexRefs[-1] = {};
            }
            const nestedRefs = indexRefs[-1];
            if (!nestedRefs) {
              return;
            }
            nestedRefs.formula = el;
          } else if (type === 'error') formulaRefs.error.current = el;
          else if (type === 'range' && index !== null) formulaRefs.range.current[index] = el;
        }}
        placeholder={placeholder}
      />
      {activeFormulaField === `${type}-${index ?? 'main'}` && (
        <div onMouseDown={e => e.preventDefault()}>
          <FormulaKeyboard
            onKeyPress={handleFormulaKeyPress}
            variables={getAvailableVariables(type, index)}
          />
        </div>
      )}
    </div>
  );
};
