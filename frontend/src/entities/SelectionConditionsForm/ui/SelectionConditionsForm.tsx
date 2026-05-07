import React, { useCallback, useRef } from 'react';
import { Input } from '../../../shared/ui/FormItems';
import { formatNumberForDisplay } from '../../../shared/utils/numberFormatting';
import type { SelectionConditionsField } from '../../../shared/api/samples';
import './SelectionConditionsForm.css';

interface SelectionConditionsFormProps {
  conditions: SelectionConditionsField[];
  values: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

const SelectionConditionsForm: React.FC<SelectionConditionsFormProps> = ({
  conditions,
  values,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const getInputElements = useCallback((): HTMLInputElement[] => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll<HTMLInputElement>('input'));
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, name: string) => {
      let value = e.target.value;
      // Заменяем точку на запятую
      value = value.replace(/\./g, ',');
      // Проверяем формат числа (с запятой или без)
      const pattern = /^-?\d*,?\d*$/;
      if (value === '' || value === '-' || pattern.test(value)) {
        const commaCount = (value.match(/,/g) || []).length;
        if (commaCount <= 1) {
          const minusCount = (value.match(/-/g) || []).length;
          if (minusCount <= 1 && value.indexOf('-') <= 0) {
            onChange(name, value);
            // Сохраняем позицию курсора
            const input = e.target;
            const position = input.selectionStart;
            setTimeout(() => {
              input.setSelectionRange(position, position);
            }, 0);
          }
        }
      }
    },
    [onChange]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>, name: string) => {
      e.preventDefault();
      const pastedText = e.clipboardData.getData('text');
      const cleanedValue = pastedText.trim().replace(/\s+/g, '');
      if (/^-?\d*,?\d*$/.test(cleanedValue)) {
        onChange(name, cleanedValue);
      }
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // `Enter` в форме должен переключать фокус между полями условий отбора.
      // Иначе он попадает под текущую фильтрацию клавиш и не даёт “переход по условиям”.
      if (
        e.code === 'Enter' ||
        e.key === 'Enter' ||
        e.code === 'NumpadEnter' ||
        e.key === 'NumpadEnter'
      ) {
        const inputs = getInputElements();
        const current = e.currentTarget;
        const currentIndex = inputs.findIndex(el => el === current);

        if (currentIndex !== -1 && currentIndex + 1 < inputs.length) {
          e.preventDefault();
          e.stopPropagation();
          inputs[currentIndex + 1].focus();
          return;
        }

        // Если это последнее поле — просто не обрабатываем “как символы ввода”.
        if (currentIndex !== -1) {
          e.stopPropagation();
          return;
        }
      }

      const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
      const allowedChars = /[-,\d]/;
      if (!allowedKeys.includes(e.key) && !allowedChars.test(e.key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
      }
    },
    [getInputElements]
  );

  const formatValue = useCallback((value: string | undefined): string => {
    if (!value || value === '') return '';
    return formatNumberForDisplay(value);
  }, []);

  if (!conditions || conditions.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="selection-conditions-form">
      <div className="form-group">
        <label>Условия отбора</label>
        <div className="conditions-grid">
          {conditions.map(condition => (
            <div key={condition.variable} className="condition-item">
              <div className="input-wrapper">
                <label>{condition.variable}</label>
                <div className="input-row">
                  <Input
                    placeholder="Введите значение"
                    value={formatValue(values[condition.variable])}
                    onChange={e => handleInputChange(e, condition.variable)}
                    onPaste={e => handlePaste(e, condition.variable)}
                    onKeyDown={handleKeyDown}
                  />
                  <div className="unit">{condition.unit}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SelectionConditionsForm;
