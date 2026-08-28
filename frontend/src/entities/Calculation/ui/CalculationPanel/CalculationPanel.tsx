import React from 'react';
import {
  getChlorideSaltsResultDisplay,
  type ResearchMethod,
  type ResearchMethodGroup,
} from '@/entities/ResearchMethod/@x/Calculation';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Form } from '@/shared/ui/Form';
import { FormItem } from '@/shared/ui/FormItem';
import { CalculatorIcon } from '@/shared/ui/icons';
import { useCalculationPanel } from '../../model/useCalculationPanel';
import CalculationPanelEmpty from './CalculationPanelEmpty';
import CalculationResultCard from './CalculationResultCard/CalculationResultCard';
import LaboratoryActivityDateSection from './LaboratoryActivityDateSection';
import MassFractionOilColorField from './MassFractionOilColorField';
import ParallelCard from './ParallelCard/ParallelCard';
import type { CalculationResult } from '../../api/calculation';
import type { Dayjs } from 'dayjs';
import './CalculationPanel.css';

export interface CalculationPanelProps {
  hasNoMethods: boolean;
  selectedMethodId: number | null;
  methods: ResearchMethod[];
  groups: ResearchMethodGroup[];
  /** Растянуть панель по высоте родителя (workspace). */
  fillParent?: boolean;
  groupSelector?: React.ReactNode;
  onCalculate?: (
    result: CalculationResult,
    inputData: Record<string, unknown>,
    laboratoryActivityDate: Dayjs | null
  ) => void;
  onSave?: () => void;
  canExecute?: boolean;
  canSave?: boolean;
  lastCalculationResult?: {
    input_data: Record<string, unknown>;
    result: string;
    result_display?: string;
    measurement_error?: string;
    unit?: string;
    convergence?: string;
  };
  laboratoryId?: number;
  departmentId?: number;
  onLoadRegistrationData?: (
    onDataLoaded: (data: {
      initialValues: Record<string, string>;
      laboratoryActivityDate: Dayjs | null;
    }) => void
  ) => void;
  /** Предзаполнение формы из сохраненного расчёта (редактирование). */
  calculationFormPrefill?: {
    methodId: number;
    initialValues: Record<string, string>;
    laboratoryActivityDate: Dayjs | null;
    waxPrecipitation?: boolean;
    massFractionOilNumericC?: Record<string, string>;
  } | null;
  /** Синхронизация даты с родителем после «Рассчитать», если пользователь меняет дату перед сохранением. */
  onLaboratoryActivityDateChange?: (date: Dayjs | null) => void;
}

const CalculationPanel = ({
  hasNoMethods,
  selectedMethodId,
  methods,
  groups,
  fillParent = false,
  groupSelector,
  onCalculate,
  onSave,
  canExecute = true,
  canSave = true,
  lastCalculationResult,
  onLoadRegistrationData,
  calculationFormPrefill,
  onLaboratoryActivityDateChange,
}: CalculationPanelProps) => {
  const panelClassName = fillParent
    ? 'calculation-panel calculation-panel--fill'
    : 'calculation-panel';
  const panel = useCalculationPanel({
    selectedMethodId,
    methods,
    groups,
    onCalculate,
    onLoadRegistrationData,
    calculationFormPrefill,
    onLaboratoryActivityDateChange,
  });

  if (hasNoMethods) {
    return (
      <div className={panelClassName}>
        <Form form={panel.form} className="calculation-panel-form-hidden">
          <div />
        </Form>
        <CalculationPanelEmpty
          title="Методы исследования отсутствуют"
          description='Добавьте первый метод исследования, нажав на кнопку "+" в левой панели'
        />
      </div>
    );
  }

  if (!selectedMethodId || !panel.currentMethod) {
    return (
      <div className={panelClassName}>
        <Form form={panel.form} className="calculation-panel-form-hidden">
          <div />
        </Form>
        <CalculationPanelEmpty description="Выберите метод исследования" />
      </div>
    );
  }

  const currentMethod = panel.currentMethod;

  return (
    <div className={panelClassName}>
      <Form
        form={panel.form}
        layout="vertical"
        preserve={false}
        onValuesChange={panel.handleFormValuesChange}
      >
        <div className="calculation-panel-content">
          <LaboratoryActivityDateSection
            value={panel.laboratoryActivityDate}
            error={panel.dateError}
            onChange={panel.handleLaboratoryActivityDateChange}
          />

          <div className="calculation-panel-method-title">
            {panel.currentMethodGroup ? panel.currentMethodGroup.name : currentMethod.name}
          </div>

          {groupSelector ? (
            <div className="calculation-panel-group-selector">{groupSelector}</div>
          ) : null}

          {panel.isTemperature20Method && (
            <div className="wax-precipitation-wrapper">
              <FormItem name={`${currentMethod.id}_wax_precipitation`}>
                <Checkbox
                  checked={panel.waxPrecipitation}
                  onChange={e => {
                    panel.setWaxPrecipitation(e.target.checked);
                  }}
                >
                  Выпадение парафина
                </Checkbox>
              </FormItem>
            </div>
          )}

          <div className="calculation-panel-cards-wrapper">
            {panel.cardIndices.map(cardIndex => {
              const cardFields = panel.fieldsWithoutColor.filter(
                field => field.card_index === cardIndex
              );
              if (cardFields.length === 0) return null;

              return (
                <ParallelCard
                  key={cardIndex}
                  cardIndex={cardIndex}
                  fields={cardFields}
                  methodId={currentMethod.id}
                  formValues={panel.formValues}
                  form={panel.form}
                  setFormValues={panel.setFormValues}
                  inputRefs={panel.inputRefs}
                  currentMethod={currentMethod}
                  lockedMethods={
                    panel.isTemperature20Method && panel.waxPrecipitation
                      ? { [currentMethod.id]: true }
                      : {}
                  }
                />
              );
            })}
            {panel.colorField && (
              <MassFractionOilColorField
                methodId={currentMethod.id}
                fieldName={panel.colorField.name}
                fieldDescription={panel.colorField.description}
                formValues={panel.formValues}
                form={panel.form}
                setFormValues={panel.setFormValues}
                disabled={panel.isTemperature20Method && panel.waxPrecipitation}
              />
            )}
          </div>

          {(panel.calculationResults[currentMethod.id] &&
            (panel.calculationResults[currentMethod.id]?.length ?? 0) > 0) ||
          lastCalculationResult ? (
            <div className="calculation-panel-results-wrapper">
              {panel.calculationResults[currentMethod.id]?.map(result => (
                <CalculationResultCard
                  key={currentMethod.id}
                  result={result}
                  currentMethod={currentMethod}
                />
              ))}
              {lastCalculationResult && !panel.calculationResults[currentMethod.id] && (
                <CalculationResultCard
                  result={{
                    result: lastCalculationResult.result,
                    result_display:
                      lastCalculationResult.result_display ||
                      getChlorideSaltsResultDisplay(lastCalculationResult.input_data),
                    measurement_error: lastCalculationResult.measurement_error,
                    unit: lastCalculationResult.unit,
                    convergence: lastCalculationResult.convergence,
                  }}
                  currentMethod={currentMethod}
                />
              )}
            </div>
          ) : null}

          <div className="calculation-panel-actions">
            {canExecute && (
              <Button
                type="primary"
                className="calculation-panel-action-btn"
                onClick={panel.handleCalculate}
                loading={panel.isCalculating}
                icon={
                  !panel.isCalculating ? (
                    <CalculatorIcon
                      ref={panel.calculateIconRef}
                      size={16}
                      className="animated-icon"
                    />
                  ) : undefined
                }
                onMouseEnter={() => panel.calculateIconRef.current?.startAnimation()}
                onMouseLeave={() => panel.calculateIconRef.current?.stopAnimation()}
              >
                Рассчитать
              </Button>
            )}
            {canSave && onSave && lastCalculationResult && (
              <Button type="primary" className="calculation-panel-action-btn" onClick={onSave}>
                Сохранить результат
              </Button>
            )}
          </div>
        </div>
      </Form>
    </div>
  );
};

export default CalculationPanel;
