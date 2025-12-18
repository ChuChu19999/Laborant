import React, { useCallback } from 'react';
import { Input } from 'antd';
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
    const allowedChars = /[-,\d]/;
    if (!allowedKeys.includes(e.key) && !allowedChars.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
    }
  }, []);

  const formatValue = useCallback((value: string | undefined): string => {
    if (!value || value === '') return '';
    return String(value).replace('.', ',');
  }, []);

  if (!conditions || conditions.length === 0) {
    return null;
  }

  return (
    <div className="selection-conditions-form">
      <div className="form-group">
        <label>Условия отбора</label>
        <div className="conditions-grid">
          {conditions.map(condition => (
            <div key={condition.variable} className="condition-item">
              <div className="input-wrapper">
                <label>{condition.variable}</label>
                <Input
                  placeholder="Введите значение"
                  value={formatValue(values[condition.variable])}
                  onChange={e => handleInputChange(e, condition.variable)}
                  onPaste={e => handlePaste(e, condition.variable)}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <div className="unit">{condition.unit}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SelectionConditionsForm;
