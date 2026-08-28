import { CalculationPanel, type CalculationResult } from '@/entities/Calculation';
import type { ResearchMethod, ResearchMethodGroup } from '@/entities/ResearchMethod';
import type { Dayjs } from 'dayjs';
import type { ReactNode } from 'react';

interface LastCalculationResult {
  input_data: Record<string, unknown>;
  result: string;
  result_display?: string;
  measurement_error?: string;
  unit?: string;
  convergence?: string;
  laboratory_activity_date: Dayjs | null;
  equipment_data?: number[];
}

interface CalculationsWorkspaceRightPanelProps {
  selectedMethodId: number | null;
  currentMethod: ResearchMethod | null;
  methodologyChoiceModalOpen: boolean;
  methods: ResearchMethod[];
  groups: ResearchMethodGroup[];
  calculationFormPrefill: {
    methodId: number;
    initialValues: Record<string, string>;
    laboratoryActivityDate: Dayjs | null;
    waxPrecipitation?: boolean;
    massFractionOilNumericC?: Record<string, string>;
  } | null;
  groupSelector?: ReactNode;
  lastCalculationResult?: LastCalculationResult;
  canExecute: boolean;
  canSave: boolean;
  onCalculate: (
    result: CalculationResult,
    inputData: Record<string, unknown>,
    laboratoryActivityDate: Dayjs | null
  ) => void;
  onSave?: () => void;
  onLaboratoryActivityDateChange: (date: Dayjs | null) => void;
}

const CalculationsWorkspaceRightPanel = ({
  selectedMethodId,
  currentMethod,
  methodologyChoiceModalOpen,
  methods,
  groups,
  calculationFormPrefill,
  groupSelector,
  lastCalculationResult,
  canExecute,
  canSave,
  onCalculate,
  onSave,
  onLaboratoryActivityDateChange,
}: CalculationsWorkspaceRightPanelProps) => {
  return (
    <div className="calculations-page-right-panel">
      {!selectedMethodId || !currentMethod ? (
        <div className="calculations-page-placeholder">
          {methodologyChoiceModalOpen ? (
            <>
              <h3>Выберите версию методики</h3>
              <p>Для продолжения укажите, по старой или новой методике редактировать расчёт.</p>
            </>
          ) : (
            <>
              <h3>Выберите метод исследования</h3>
              <p>Выберите метод исследования слева, чтобы начать расчёт.</p>
            </>
          )}
        </div>
      ) : (
        <CalculationPanel
          hasNoMethods={false}
          selectedMethodId={selectedMethodId}
          methods={methods}
          groups={groups}
          fillParent
          calculationFormPrefill={calculationFormPrefill}
          groupSelector={groupSelector}
          onCalculate={onCalculate}
          onSave={onSave}
          lastCalculationResult={lastCalculationResult}
          onLaboratoryActivityDateChange={onLaboratoryActivityDateChange}
          canExecute={canExecute}
          canSave={canSave}
        />
      )}
    </div>
  );
};

export default CalculationsWorkspaceRightPanel;
