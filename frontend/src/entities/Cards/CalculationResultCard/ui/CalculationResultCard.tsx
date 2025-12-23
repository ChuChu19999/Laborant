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

interface CalculationResult {
  result?: string;
  measurement_error?: string;
  unit?: string;
  convergence?: string;
  intermediate_results?: Record<string, string>;
  conditions_info?: ConditionInfo[];
  is_fractional_composition?: boolean;
}

interface CalculationResultCardProps {
  result: CalculationResult;
  currentMethod?: {
    name?: string;
    intermediate_data?: {
      fields?: IntermediateField[];
    };
  };
}

const CalculationResultCard: React.FC<CalculationResultCardProps> = ({ result, currentMethod }) => {
  const isMassFractionOilMethod = currentMethod?.name === 'Массовая доля нефти';
  const isFractionalComposition = result.is_fractional_composition;
  const csrValue = result.intermediate_results?.['Cср'];
  const shouldShowLessThan =
    isMassFractionOilMethod && csrValue && parseFloat(csrValue.replace(',', '.')) < 0.1;

  const formatFormula = (formula: string): string => {
    return processAbs(formula)
      .replace(/\*/g, '×')
      .replace(/<=/g, '≤')
      .replace(/>=/g, '≥')
      .replace(/\./g, ',')
      .replace(/or/g, 'или')
      .replace(/and/g, 'и');
  };

  const getResultText = (): string => {
    if (result.convergence === 'custom') {
      return shouldShowLessThan ? ' менее 0,1' : ` ${result.result || ''}`;
    } else if (result.convergence === 'satisfactory') {
      if (shouldShowLessThan) {
        return ' менее 0,1';
      }
      return ` ${result.result || ''} ± ${result.measurement_error || ''} ${result.unit || ''}`;
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

  const formatIntermediateValue = (name: string, value: string): string => {
    if (isFractionalComposition && currentMethod?.name === 'Фракционный состав (нефть)') {
      return roundValueForOilFractional(value, name);
    }
    if (isFractionalComposition && currentMethod?.name === 'Фракционный состав (конденсат)') {
      return roundValueForCondensateFractional(value, name);
    }
    if (result.result) {
      return roundValue(value, result.result);
    }
    return value;
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
                        : condition.calculation_steps.steps?.[0]?.evaluated}
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
                <span className="calculation-intermediate-value">
                  {formatIntermediateValue(name, value)}
                  {field?.unit && (
                    <span className="calculation-intermediate-unit"> {field.unit}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CalculationResultCard;
