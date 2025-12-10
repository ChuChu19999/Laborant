export const CONVERGENCE_LABELS = {
  custom: (value: string) => value,
  satisfactory: 'Удовлетворительно',
  unsatisfactory: 'Неудовлетворительно',
  absence: 'Отсутствие',
  traces: 'Следы',
};

export const processAbs = (formula: string): string => {
  let result = formula;
  let startIndex: number;
  while ((startIndex = result.indexOf('abs(')) !== -1) {
    let openBrackets = 1;
    let currentIndex = startIndex + 4;

    while (openBrackets > 0 && currentIndex < result.length) {
      if (result[currentIndex] === '(') openBrackets++;
      if (result[currentIndex] === ')') openBrackets--;
      currentIndex++;
    }

    if (openBrackets === 0) {
      const content = result.substring(startIndex + 4, currentIndex - 1);
      result =
        result.substring(0, startIndex) + '|' + content + '|' + result.substring(currentIndex);
    } else {
      break;
    }
  }
  return result;
};

export const getDecimalPlaces = (numStr: string): number => {
  if (!numStr) return 0;
  const parts = numStr.toString().split(',');
  return parts.length > 1 ? parts[1].length : 0;
};

export const roundValue = (value: string, mainResult: string): string => {
  const decimalPlaces = getDecimalPlaces(mainResult) + 1;
  const numValue = parseFloat(value.replace(',', '.'));
  return numValue.toFixed(decimalPlaces).replace('.', ',');
};

export const roundValueForOilFractional = (value: string, fieldName: string): string => {
  const numValue = parseFloat(value.replace(',', '.'));

  if (
    fieldName === 'Температура н.к.' ||
    fieldName === '10% отгона при температуре' ||
    fieldName === '50% отгона при температуре'
  ) {
    return Math.round(numValue).toString();
  }

  return numValue.toFixed(1).replace('.', ',');
};

export const roundValueForCondensateFractional = (value: string, fieldName: string): string => {
  const numValue = parseFloat(value.replace(',', '.'));

  if (
    fieldName.toLowerCase().includes('температура') ||
    fieldName.toLowerCase().includes('отгона при температуре')
  ) {
    return Math.round(numValue).toString();
  }

  return numValue.toFixed(1).replace('.', ',');
};

export const getCardParallelLabel = (
  cardFields: Array<{ description?: string }>
): string | null => {
  if (!cardFields || cardFields.length === 0) return null;

  const descriptionText = cardFields
    .map(field => (field.description || '').toLowerCase())
    .join(' ');

  if (
    descriptionText.includes('первой параллели') ||
    descriptionText.includes('первая параллель') ||
    descriptionText.includes('первой параллель')
  ) {
    return 'Параллель 1';
  }
  if (
    descriptionText.includes('второй параллели') ||
    descriptionText.includes('вторая параллель') ||
    descriptionText.includes('второй параллель')
  ) {
    return 'Параллель 2';
  }
  if (
    descriptionText.includes('третьей параллели') ||
    descriptionText.includes('третья параллель') ||
    descriptionText.includes('третьей параллель')
  ) {
    return 'Параллель 3';
  }

  return null;
};
