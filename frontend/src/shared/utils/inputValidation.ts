export interface NumericInputValidationResult {
  isValid: boolean;
  normalizedValue: string;
}

export const validateNumericInputWithComma = (value: string): NumericInputValidationResult => {
  const normalizedValue = value.replace(/\./g, ',');
  const pattern = /^-?\d*,?\d*$/;

  if (value === '' || value === '-' || pattern.test(normalizedValue)) {
    const commaCount = (normalizedValue.match(/,/g) || []).length;
    if (commaCount <= 1) {
      const minusCount = (normalizedValue.match(/-/g) || []).length;
      if (minusCount <= 1 && (!normalizedValue.includes('-') || normalizedValue.startsWith('-'))) {
        return {
          isValid: true,
          normalizedValue,
        };
      }
    }
  }

  return {
    isValid: false,
    normalizedValue,
  };
};

export const preserveCursorPosition = (input: HTMLInputElement, callback: () => void): void => {
  const position = input.selectionStart;
  callback();
  setTimeout(() => {
    input.setSelectionRange(position, position);
  }, 0);
};
