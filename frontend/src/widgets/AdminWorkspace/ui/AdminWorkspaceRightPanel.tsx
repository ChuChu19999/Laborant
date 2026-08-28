import {
  CalculationPanel,
  RegistrationNumberPicker,
  type CalculationResult,
} from '@/entities/Calculation';
import { Button } from '@/shared/ui/Button';
import { SettingOutlined } from '@/shared/ui/icons';
import { Tooltip } from '@/shared/ui/Tooltip';
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

interface AdminWorkspaceRightPanelProps {
  laboratoryId?: number;
  departmentId?: number;
  registrationNumber: string;
  onRegistrationNumberChange: (value: string) => void;
  isLoadingRegistrationData: boolean;
  onLoadRegistrationData: () => void;
  onOpenEquipmentModal: () => void;
  hasNoMethods: boolean;
  selectedMethodId: number | null;
  methods: ResearchMethod[];
  groups: ResearchMethodGroup[];
  groupSelector?: ReactNode;
  currentMethod: ResearchMethod | null;
  lastCalculationResult?: LastCalculationResult;
  onCalculate: (
    result: CalculationResult,
    inputData: Record<string, unknown>,
    laboratoryActivityDate: Dayjs | null
  ) => void;
  onSave: () => void;
  onLaboratoryActivityDateChange: (date: Dayjs | null) => void;
  onRegistrationDataLoader: (
    callback: (data: {
      initialValues: Record<string, string>;
      laboratoryActivityDate: Dayjs | null;
    }) => void
  ) => void;
}

const AdminWorkspaceRightPanel = ({
  laboratoryId,
  departmentId,
  registrationNumber,
  onRegistrationNumberChange,
  isLoadingRegistrationData,
  onLoadRegistrationData,
  onOpenEquipmentModal,
  hasNoMethods,
  selectedMethodId,
  methods,
  groups,
  groupSelector,
  currentMethod,
  lastCalculationResult,
  onCalculate,
  onSave,
  onLaboratoryActivityDateChange,
  onRegistrationDataLoader,
}: AdminWorkspaceRightPanelProps) => {
  return (
    <div className="admin-page-right-panel">
      <div className="admin-page-right-panel-header">
        {laboratoryId && (
          <div className="admin-page-registration-wrapper">
            <RegistrationNumberPicker
              value={registrationNumber}
              onChange={onRegistrationNumberChange}
              laboratoryId={laboratoryId}
              departmentId={departmentId}
              methodId={currentMethod?.id || null}
              className="admin-page-registration-input"
            />
            <Button
              onClick={onLoadRegistrationData}
              loading={isLoadingRegistrationData}
              className="admin-page-load-button"
            >
              Показать
            </Button>
          </div>
        )}
        <Tooltip title="Приборы по умолчанию" placement="top">
          <Button
            icon={<SettingOutlined className="admin-page-button-settings-icon" />}
            className="admin-page-button-settings"
            onClick={onOpenEquipmentModal}
            disabled={!currentMethod}
          />
        </Tooltip>
      </div>
      <CalculationPanel
        hasNoMethods={hasNoMethods}
        selectedMethodId={selectedMethodId}
        methods={methods}
        groups={groups}
        groupSelector={groupSelector}
        onCalculate={onCalculate}
        onSave={onSave}
        lastCalculationResult={lastCalculationResult}
        onLaboratoryActivityDateChange={onLaboratoryActivityDateChange}
        laboratoryId={laboratoryId}
        departmentId={departmentId}
        onLoadRegistrationData={onRegistrationDataLoader}
      />
    </div>
  );
};

export default AdminWorkspaceRightPanel;
