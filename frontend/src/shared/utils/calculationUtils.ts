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

export const formatConvergenceFormula = (formula: string): string => {
  return processAbs(formula)
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/\./g, ',')
    .replace(/or/g, 'или')
    .replace(/and/g, 'и');
};

export interface ConvergenceStepDisplay {
  original?: string;
  evaluated?: string;
  type?: string;
  condition?: ConvergenceStepDisplay;
  conditions?: ConvergenceStepDisplay[];
}

export interface ConvergenceCalculationStepsDisplay {
  type?: string;
  step?: ConvergenceStepDisplay;
  steps?: ConvergenceStepDisplay[];
  step2?: string;
}

export interface ConvergenceStepsDisplayParts {
  original?: string;
  evaluated?: string;
}

const uniqueNonEmpty = (items: (string | undefined)[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    if (!item || seen.has(item)) {
      continue;
    }
    seen.add(item);
    result.push(item);
  }
  return result;
};

const stripOuterParens = (value: string): string => value.replace(/^\(|\)$/g, '').trim();

const collectDisplaySteps = (
  calculationSteps: ConvergenceCalculationStepsDisplay
): ConvergenceStepDisplay[] => {
  if (calculationSteps.type === 'single' && calculationSteps.step) {
    return [calculationSteps.step];
  }

  if (calculationSteps.type === 'and' && calculationSteps.steps?.length) {
    const lastStep = calculationSteps.steps[calculationSteps.steps.length - 1];
    return lastStep ? [lastStep] : [];
  }

  if (calculationSteps.type === 'or' && calculationSteps.steps?.length) {
    const result: ConvergenceStepDisplay[] = [];
    for (const orStep of calculationSteps.steps) {
      if (orStep.type === 'and' && orStep.conditions?.length) {
        const lastCondition = orStep.conditions[orStep.conditions.length - 1];
        if (lastCondition) {
          result.push(lastCondition);
        }
      } else if (orStep.type === 'single' && orStep.condition) {
        result.push(orStep.condition);
      } else if (orStep.original || orStep.evaluated) {
        result.push(orStep);
      }
    }
    return result;
  }

  if (calculationSteps.steps?.length) {
    if (calculationSteps.type === 'and') {
      const lastStep = calculationSteps.steps[calculationSteps.steps.length - 1];
      return lastStep ? [lastStep] : [];
    }
    return calculationSteps.steps;
  }

  return [];
};

const joinDisplayParts = (
  parts: string[],
  separator: string,
  wrapEach = false
): string | undefined => {
  if (parts.length === 0) {
    return undefined;
  }
  if (parts.length === 1) {
    return wrapEach ? `(${parts[0]})` : parts[0];
  }
  return parts.map(part => (wrapEach ? `(${part})` : part)).join(separator);
};

/** Сырое подставленное условие и вычисленные части на разных строках; одинаковые части не дублируются. */
export const getConvergenceStepsDisplayParts = (
  calculationSteps?: ConvergenceCalculationStepsDisplay
): ConvergenceStepsDisplayParts => {
  if (!calculationSteps) {
    return {};
  }

  const steps = collectDisplaySteps(calculationSteps);
  if (steps.length === 0) {
    return {};
  }

  const rawParts = uniqueNonEmpty(
    steps.map(step => (step.original ? formatConvergenceFormula(step.original) : undefined))
  );
  const evaluatedParts = uniqueNonEmpty(
    steps.map(step => (step.evaluated ? formatConvergenceFormula(step.evaluated) : undefined))
  );

  const rawLine = joinDisplayParts(rawParts, ' или ', false);
  const evaluatedLine = joinDisplayParts(evaluatedParts, ' или ', true);

  if (rawLine && evaluatedLine && stripOuterParens(rawLine) === stripOuterParens(evaluatedLine)) {
    return { evaluated: evaluatedLine };
  }

  return {
    original: rawLine,
    evaluated: evaluatedLine,
  };
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
