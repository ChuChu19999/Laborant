import React from 'react';
import { BiHelpCircle } from 'react-icons/bi';
import Tooltip from '../../../../shared/ui/Tooltip/Tooltip';
import {
  CONVERGENCE_LABELS,
  processAbs,
  roundValue,
  roundValueForOilFractional,
  roundValueForCondensateFractional,
} from '../../../../shared/utils/calculationUtils';
import { isMassFractionOilResearchMethod } from '../../../../shared/utils/massFractionOilMethod';
import './CalculationResultCard.css';

interface ConditionInfo {
  satisfied: boolean;
  formula?: string;
  calculation_steps?: {
    type?: string;
    step?: {
      evaluated?: string;
    };
    steps?: Array<{
      evaluated?: string;
    }>;
    step2?: string;
  };
  convergence_value?: string;
}

interface IntermediateField {
  name: string;
  description?: string;
  unit?: string;
}

interface IntermediateResultValue {
  value: string;
  reference: string;
}

interface CalculationResult {
  result?: string;
  result_reference?: string;
  result_display?: string;
  measurement_error?: string;
  unit?: string;
  convergence?: string;
  intermediate_results?: Record<string, string | IntermediateResultValue>;
  conditions_info?: ConditionInfo[];
  is_fractional_composition?: boolean;
}

interface CalculationResultCardProps {
  result: CalculationResult;
  currentMethod?: {
    name?: string;
    groups?: Array<{ name: string }>;
    intermediate_data?: {
      fields?: IntermediateField[];
    };
    input_data?: {
      fields?: Array<{
        name: string;
        unit?: string;
      }>;
    };
  };
}

const CalculationResultCard: React.FC<CalculationResultCardProps> = ({ result, currentMethod }) => {
  const isMassFractionOilMethod = isMassFractionOilResearchMethod(currentMethod);
  const chlorideResultDisplay = result.result_display?.trim();
  const isFractionalComposition = result.is_fractional_composition;
  const csrValue = result.intermediate_results?.['Cср'];
  const csrValueStr =
    typeof csrValue === 'object' && 'value' in csrValue
      ? csrValue.value
      : typeof csrValue === 'string'
        ? csrValue
        : '';
  const shouldShowLessThan =
    isMassFractionOilMethod && csrValueStr && parseFloat(csrValueStr.replace(',', '.')) < 0.1;

  const formatFormula = (formula: string): string => {
    return processAbs(formula)
      .replace(/\*/g, '×')
      .replace(/<=/g, '≤')
      .replace(/>=/g, '≥')
      .replace(/\./g, ',')
      .replace(/or/g, 'или')
      .replace(/and/g, 'и');
  };

  const getResultText = (): React.ReactNode => {
    if (result.convergence === 'custom') {
      if (chlorideResultDisplay) {
        return ` ${chlorideResultDisplay}`;
      }
      return shouldShowLessThan ? ' менее 0,1' : ` ${result.result || ''}`;
    } else if (result.convergence === 'satisfactory') {
      if (shouldShowLessThan) {
        return ' менее 0,1';
      }
      // Специальная обработка для "выпадение парафина" - выводим без ± и единиц измерения
      if (result.result === 'выпадение парафина') {
        return <span>{result.result}</span>;
      }
      return (
        <span>
          {result.result || ''} ± {result.measurement_error || ''} {result.unit || ''}
        </span>
      );
    } else if (result.convergence === 'absence') {
      return ' Отсутствие';
    } else if (result.convergence === 'traces') {
      return ' Следы';
    } else {
      return ' Неудовлетворительно';
    }
  };

  const getConvergenceLabel = (convergenceValue?: string): string => {
    if (!convergenceValue) return '';
    const label = CONVERGENCE_LABELS[convergenceValue as keyof typeof CONVERGENCE_LABELS];
    if (typeof label === 'function') {
      return label('');
    }
    return label || '';
  };

  const getIntermediateUnit = (name: string): string | undefined => {
    if (name === 'Объемная доля потерь') {
      return '%';
    }

    const field = currentMethod?.intermediate_data?.fields?.find(f => f.name === name);
    if (field?.unit) {
      return field.unit;
    }

    const inputFields = currentMethod?.input_data?.fields || [];
    if (inputFields.length === 0) {
      return undefined;
    }

    const directMatch = inputFields.find(f => f.name === name && f.unit);
    if (directMatch?.unit) {
      return directMatch.unit;
    }

    const nameParts = name.split(' ');
    if (nameParts.length >= 2) {
      const tailName = nameParts.slice(-2).join(' ');
      const tailMatch = inputFields.find(f => f.name === tailName && f.unit);
      if (tailMatch?.unit) {
        return tailMatch.unit;
      }
    }

    return undefined;
  };

  const formatIntermediateValue = (
    name: string,
    value: string | IntermediateResultValue
  ): React.ReactNode => {
    // Если значение - объект с value и reference
    if (typeof value === 'object' && 'value' in value && 'reference' in value) {
      const mainValueStr = String(value.value).replace('.', ',');
      const refValueStr = String(value.reference).replace('.', ',');

      if (isFractionalComposition && currentMethod?.name === 'Фракционный состав (нефть)') {
        const mainFormatted = roundValueForOilFractional(String(value.value), name);
        const refFormatted = roundValueForOilFractional(String(value.reference), name);
        return (
          <>
            <span className="calculation-intermediate-main">
              {mainFormatted}{' '}
              <span className="calculation-intermediate-used-badge">(используется)</span>
            </span>
            <span className="calculation-intermediate-reference">
              Справка (с точностью +1 знак): {refFormatted}
            </span>
          </>
        );
      }
      if (isFractionalComposition && currentMethod?.name === 'Фракционный состав (конденсат)') {
        const mainFormatted = roundValueForCondensateFractional(String(value.value), name);
        const refFormatted = roundValueForCondensateFractional(String(value.reference), name);
        return (
          <>
            <span className="calculation-intermediate-main">
              {mainFormatted}{' '}
              <span className="calculation-intermediate-used-badge">(используется)</span>
            </span>
            <span className="calculation-intermediate-reference">
              Справка (с точностью +1 знак): {refFormatted}
            </span>
          </>
        );
      }
      return (
        <>
          <span className="calculation-intermediate-main">
            {mainValueStr}{' '}
            <span className="calculation-intermediate-used-badge">(используется)</span>
          </span>
          <span className="calculation-intermediate-reference">
            Справка (с точностью +1 знак): {refValueStr}
          </span>
        </>
      );
    }

    // Старый формат (строка) - для обратной совместимости
    const valueStr = typeof value === 'string' ? value : String(value);
    if (isFractionalComposition && currentMethod?.name === 'Фракционный состав (нефть)') {
      return roundValueForOilFractional(valueStr, name);
    }
    if (isFractionalComposition && currentMethod?.name === 'Фракционный состав (конденсат)') {
      return roundValueForCondensateFractional(valueStr, name);
    }
    if (result.result) {
      return roundValue(valueStr, result.result);
    }
    return valueStr;
  };

  return (
    <div className="calculation-result-card">
      {!isFractionalComposition && (
        <div className="calculation-result-main">
          <p className="calculation-result-value">{getResultText()}</p>
        </div>
      )}

      {!isFractionalComposition && result.conditions_info && result.conditions_info.length > 0 && (
        <div className="calculation-result-section">
          <p className="calculation-result-section-title">Проверка повторяемости:</p>
          {result.conditions_info.map(
            (condition, condIndex) =>
              condition.satisfied && (
                <div key={condIndex} className="calculation-condition">
                  <div className="calculation-condition-formula">
                    {condition.calculation_steps?.step2
                      ? formatFormula(condition.calculation_steps.step2)
                      : condition.formula
                        ? formatFormula(condition.formula)
                        : ''}
                  </div>

                  {condition.calculation_steps && (
                    <div className="calculation-condition-steps">
                      {condition.calculation_steps.type === 'single'
                        ? condition.calculation_steps.step?.evaluated
                          ? formatFormula(condition.calculation_steps.step.evaluated)
                          : ''
                        : condition.calculation_steps.steps?.[0]?.evaluated
                          ? formatFormula(condition.calculation_steps.steps[0].evaluated)
                          : ''}
                    </div>
                  )}

                  <div className="calculation-condition-result">
                    {getConvergenceLabel(condition.convergence_value)}
                  </div>
                </div>
              )
          )}
        </div>
      )}

      {result.intermediate_results && Object.keys(result.intermediate_results).length > 0 && (
        <div className="calculation-result-section">
          <p className="calculation-result-section-title">
            {isFractionalComposition ? 'Результат:' : 'Промежуточные результаты:'}
          </p>
          {Object.entries(result.intermediate_results).map(([name, value]) => {
            const field = currentMethod?.intermediate_data?.fields?.find(f => f.name === name);
            const unit = getIntermediateUnit(name);
            return (
              <div key={name} className="calculation-intermediate-item">
                <div className="calculation-intermediate-name">
                  <span>{name}</span>
                  {field?.description && (
                    <Tooltip title={field.description} placement="right">
                      <BiHelpCircle size={16} className="calculation-intermediate-icon" />
                    </Tooltip>
                  )}
                </div>
                <div className="calculation-intermediate-value-container">
                  <div className="calculation-intermediate-value">
                    {formatIntermediateValue(name, value)}
                    {unit && <span className="calculation-intermediate-unit"> {unit}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CalculationResultCard;
