import React from 'react';
import type { RefObject } from 'react';
import { BiHelpCircle } from 'react-icons/bi';
import { FormItem } from '../../../../features/FormItems';
import { Input } from '../../../../shared/ui/FormItems';
import Tooltip from '../../../../shared/ui/Tooltip/Tooltip';
import { getCardParallelLabel as getCardParallelLabelUtil } from '../../../../shared/utils/calculationUtils';
import {
  validateNumericInputWithComma,
  preserveCursorPosition,
} from '../../../../shared/utils/inputValidation';
import type { FormInstance, InputRef } from 'antd';
import './ParallelCard.css';

interface Field {
  name: string;
  description?: string;
  unit?: string;
  card_index?: number;
}

interface ParallelCardProps {
  cardIndex: number;
  fields: Field[];
  methodId: number | string;
  formValues: Record<string, string | number | undefined>;
  form: FormInstance;
  setFormValues: (
    values:
      | Record<string, string | number | undefined>
      | ((
          prev: Record<string, string | number | undefined>
        ) => Record<string, string | number | undefined>)
  ) => void;
  inputRefs: RefObject<Record<string, InputRef | null>>;
  currentMethod?: {
    name?: string;
  };
  lockedMethods?: Record<string | number, boolean>;
}

const ParallelCard: React.FC<ParallelCardProps> = ({
  fields,
  methodId,
  formValues,
  form,
  setFormValues,
  inputRefs,
  currentMethod,
  lockedMethods = {},
}) => {
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentFieldIndex: number,
    cardFields: Field[]
  ) => {
    if (e.ctrlKey || e.metaKey) {
      const allowedKeyCodes = ['KeyA', 'KeyC', 'KeyV', 'KeyX'];
      if (allowedKeyCodes.includes(e.code)) {
        return;
      }
    }

    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      const nextFieldIndex = (currentFieldIndex + 1) % cardFields.length;
      const nextField = cardFields[nextFieldIndex];

      const nextFieldName =
        nextField.card_index && nextField.card_index > 1
          ? `${methodId}_${nextField.name}_card_${nextField.card_index}`
          : `${methodId}_${nextField.name}`;

      if (inputRefs.current[nextFieldName]) {
        inputRefs.current[nextFieldName]?.focus();
      }
      return;
    }

    if (e.code === 'Tab') {
      e.preventDefault();
      return;
    }

    if (
      e.code === 'Backspace' ||
      e.code === 'Delete' ||
      e.code === 'Escape' ||
      e.code === 'Comma' ||
      e.code === 'Minus' ||
      e.code === 'NumpadSubtract' ||
      e.code === 'NumpadDecimal' ||
      e.code.startsWith('Digit') ||
      e.code.startsWith('Numpad')
    ) {
      return;
    }

    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
      return;
    }

    e.preventDefault();
  };

  const parallelLabel = getCardParallelLabelUtil(fields);
  const isMassFractionOilMethod = currentMethod?.name === 'Массовая доля нефти';

  return (
    <div className="parallel-card">
      {parallelLabel && <div className="parallel-card-label">{parallelLabel}</div>}
      {fields.map((field, fieldIndex) => {
        const formFieldName =
          field.card_index && field.card_index > 1
            ? `${methodId}_${field.name}_card_${field.card_index}`
            : `${methodId}_${field.name}`;
        const fieldValue = formValues[formFieldName];

        const isCField =
          field.name === 'C₁' || field.name === 'C₂' || field.name === 'C1' || field.name === 'C2';
        const shouldDisableField = isMassFractionOilMethod && isCField;

        return (
          <div key={fieldIndex} className="input-field-container">
            <FormItem
              title={
                <div className="parallel-card-title-wrapper">
                  <span className="parallel-card-title-text">{field.name}</span>
                  <Tooltip title={field.description || ''} placement="right">
                    <BiHelpCircle size={16} className="parallel-card-title-icon" />
                  </Tooltip>
                </div>
              }
              name={formFieldName}
            >
              <div className="parallel-card-input-wrapper">
                <Input
                  ref={el => {
                    if (inputRefs.current) {
                      inputRefs.current[formFieldName] = el;
                    }
                  }}
                  placeholder={`Введите ${field.name}`}
                  className="hover-input parallel-card-input"
                  value={fieldValue}
                  disabled={lockedMethods[methodId] || shouldDisableField}
                  onChange={e => {
                    if (shouldDisableField) {
                      return;
                    }
                    const validation = validateNumericInputWithComma(e.target.value);
                    if (validation.isValid) {
                      preserveCursorPosition(e.target, () => {
                        form.setFieldValue(formFieldName, validation.normalizedValue);
                        setFormValues(prev => ({
                          ...prev,
                          [formFieldName]: validation.normalizedValue,
                        }));
                      });
                    }
                  }}
                  onKeyDown={e => handleKeyDown(e, fieldIndex, fields)}
                  onPaste={e => {
                    if (shouldDisableField) {
                      e.preventDefault();
                      return;
                    }
                    e.preventDefault();
                    const pastedText = e.clipboardData.getData('text');
                    const cleanedValue = pastedText.trim().replace(/\s+/g, '');
                    form.setFieldValue(formFieldName, cleanedValue);
                    setFormValues(prev => ({
                      ...prev,
                      [formFieldName]: cleanedValue,
                    }));
                  }}
                />
                {field.unit && <span className="parallel-card-unit">{field.unit}</span>}
              </div>
            </FormItem>
          </div>
        );
      })}
    </div>
  );
};

export default ParallelCard;
