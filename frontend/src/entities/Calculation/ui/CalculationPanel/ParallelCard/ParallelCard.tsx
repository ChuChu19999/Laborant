import React from 'react';
import {
  getCardParallelLabel as getCardParallelLabelUtil,
  isMassFractionOilResearchMethod,
} from '@/entities/ResearchMethod/@x/Calculation';
import { validateNumericInputWithComma } from '@/shared/lib/validation';
import { Form, type FormInstance } from '@/shared/ui/Form';
import { Input, type InputRef } from '@/shared/ui/FormItems';
import { CircleHelpIcon } from '@/shared/ui/icons';
import { Tooltip } from '@/shared/ui/Tooltip';
import type { RefObject } from 'react';
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
    groups?: { name: string }[];
  };
  lockedMethods?: Record<string | number, boolean>;
}

const ParallelCard = ({
  fields,
  methodId,
  formValues,
  form,
  setFormValues,
  inputRefs,
  currentMethod,
  lockedMethods = {},
}: ParallelCardProps) => {
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
      if (!nextField) {
        return;
      }

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

    // Проверка на запятую и точку: разрешаем ввод точки, которая заменится на запятую
    // Проверяем фактический символ, который будет введён (e.key), чтобы работать с любой раскладкой
    if (
      e.key === ',' ||
      e.key === '.' ||
      e.code === 'Comma' ||
      e.code === 'NumpadDecimal' ||
      e.code === 'Period'
    ) {
      // Получаем текущее значение поля
      const currentField = cardFields[currentFieldIndex];
      if (!currentField) return;
      const formFieldName =
        currentField.card_index && currentField.card_index > 1
          ? `${methodId}_${currentField.name}_card_${currentField.card_index}`
          : `${methodId}_${currentField.name}`;
      const currentValue = formValues[formFieldName]?.toString() || '';

      // Блокируем только если это явно буква кириллицы (например, "б", "ю" и другие)
      // Проверяем, является ли символ буквой кириллицы
      const isCyrillicLetter = /[а-яёА-ЯЁ]/.test(e.key);
      if (isCyrillicLetter) {
        e.preventDefault();
        return;
      }

      // Если уже есть запятая, блокируем ввод новой запятой или точки
      if (currentValue.includes(',')) {
        e.preventDefault();
        return;
      }

      // Разрешаем ввод - валидация в onChange заменит точку на запятую и проверит корректность
      return;
    }

    // Проверка на минус: разрешаем только один минус и только в начале
    if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
      // Получаем текущее значение поля
      const currentField = cardFields[currentFieldIndex];
      if (!currentField) return;
      const formFieldName =
        currentField.card_index && currentField.card_index > 1
          ? `${methodId}_${currentField.name}_card_${currentField.card_index}`
          : `${methodId}_${currentField.name}`;
      const currentValue = formValues[formFieldName]?.toString() || '';
      const inputElement = e.target as HTMLInputElement;
      const cursorPosition = inputElement.selectionStart || 0;

      // Если минус уже есть в значении, блокируем ввод
      if (currentValue.includes('-')) {
        e.preventDefault();
        return;
      }

      // Если курсор не в начале, блокируем ввод минуса
      if (cursorPosition !== 0) {
        e.preventDefault();
        return;
      }

      // Разрешаем ввод минуса в начале
      return;
    }

    if (
      e.code === 'Backspace' ||
      e.code === 'Delete' ||
      e.code === 'Escape' ||
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
  const isMassFractionOilMethod = isMassFractionOilResearchMethod(currentMethod);

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
            <div className="parallel-card-form-row">
              <div className="parallel-card-title-wrapper">
                <span className="parallel-card-title-text">{field.name}</span>
                <Tooltip title={field.description || ''} placement="right">
                  <CircleHelpIcon size={16} className="parallel-card-title-icon animated-icon" />
                </Tooltip>
              </div>
              <Form.Item name={formFieldName} className="parallel-card-form-item">
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
                      if (shouldDisableField || lockedMethods[methodId]) {
                        return;
                      }

                      const inputValue = e.target.value;
                      const currentFormValue = formValues[formFieldName]?.toString() || '';

                      // Пропускаем обработку, если значение уже нормализовано (избегаем повторных вызовов)
                      if (inputValue === currentFormValue && !inputValue.includes('.')) {
                        return;
                      }

                      const validation = validateNumericInputWithComma(inputValue);
                      // Проверяем, что исходное значение содержит только допустимые символы (цифры, точка, запятая, минус)
                      const containsOnlyValidChars = /^[-.,\d]*$/.test(inputValue);
                      // Проверяем, есть ли в исходном значении точка (которую нужно заменить на запятую)
                      const hasPoint = inputValue.includes('.');
                      // Проверяем, отличается ли нормализованное значение от введённого
                      const valueChanged = validation.normalizedValue !== inputValue;

                      // Проверяем и нормализуем минус: он должен быть только один и только в начале
                      let finalValue = validation.normalizedValue;
                      if (finalValue.includes('-')) {
                        // Если минус не в начале, перемещаем его в начало
                        if (!finalValue.startsWith('-')) {
                          finalValue = '-' + finalValue.replace(/-/g, '');
                        }
                        // Убеждаемся, что минус только один
                        const minusCount = (finalValue.match(/-/g) || []).length;
                        if (minusCount > 1) {
                          finalValue = '-' + finalValue.replace(/-/g, '');
                        }
                      }

                      // Применяем нормализованное значение, если:
                      // 1. В исходном значении есть точка (нужно заменить на запятую) и значение содержит только допустимые символы
                      // 2. Или значение валидно
                      // И только если нормализованное значение отличается от введённого
                      const needsUpdate = valueChanged || finalValue !== validation.normalizedValue;
                      if (
                        needsUpdate &&
                        ((hasPoint && containsOnlyValidChars) || validation.isValid)
                      ) {
                        form.setFieldValue(formFieldName, finalValue);
                        setFormValues(prev => ({
                          ...prev,
                          [formFieldName]: finalValue,
                        }));

                        // Принудительно обновляем значение в нативном input через ref
                        const inputRef = inputRefs.current?.[formFieldName];
                        if (inputRef && inputRef.input) {
                          const nativeInput = inputRef.input;
                          const cursorPosition = nativeInput.selectionStart || 0;
                          const valueDescriptor = Object.getOwnPropertyDescriptor(
                            nativeInput.constructor.prototype,
                            'value'
                          );
                          // Сеттер value нужно вызывать с контекстом input, иначе React не увидит изменение
                          const setNativeValue = valueDescriptor?.set?.bind(nativeInput);
                          if (setNativeValue) {
                            setNativeValue(finalValue);
                            const event = new Event('input', { bubbles: true });
                            nativeInput.dispatchEvent(event);
                          } else {
                            nativeInput.value = finalValue;
                          }
                          setTimeout(() => {
                            nativeInput.setSelectionRange(cursorPosition, cursorPosition);
                          }, 0);
                        }
                      }
                    }}
                    onKeyDown={e => handleKeyDown(e, fieldIndex, fields)}
                    onPaste={e => {
                      if (shouldDisableField || lockedMethods[methodId]) {
                        e.preventDefault();
                        return;
                      }
                      e.preventDefault();
                      const pastedText = e.clipboardData.getData('text');
                      const cleanedValue = pastedText.trim().replace(/\s+/g, '');
                      const validation = validateNumericInputWithComma(cleanedValue);
                      if (validation.isValid) {
                        // Нормализуем минус: он должен быть только в начале
                        let finalValue = validation.normalizedValue;
                        if (finalValue.includes('-') && !finalValue.startsWith('-')) {
                          // Если минус не в начале, перемещаем его в начало
                          finalValue = '-' + finalValue.replace(/-/g, '');
                        }
                        // Убеждаемся, что минус только один
                        const minusCount = (finalValue.match(/-/g) || []).length;
                        if (minusCount > 1) {
                          finalValue = '-' + finalValue.replace(/-/g, '');
                        }

                        form.setFieldValue(formFieldName, finalValue);
                        setFormValues(prev => ({
                          ...prev,
                          [formFieldName]: finalValue,
                        }));
                      }
                    }}
                  />
                  {field.unit && <span className="parallel-card-unit">{field.unit}</span>}
                </div>
              </Form.Item>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ParallelCard;
