import { MethodologyVersionChoiceModal } from '@/features/MethodologyVersionChoiceModal';
import { SaveCalculationModal } from '@/features/SaveCalculationModal';
import { Select } from '@/shared/ui/FormItems';
import { Layout } from '@/shared/ui/Layout';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import { SplitPanel } from '@/shared/ui/SplitPanel';
import { useCalculationsWorkspace } from '../model/useCalculationsWorkspace';
import CalculationsMethodsPanel from './CalculationsMethodsPanel';
import CalculationsWorkspaceRightPanel from './CalculationsWorkspaceRightPanel';
import './CalculationsWorkspace.css';

const { Option } = Select;

const CalculationsWorkspace = () => {
  const workspace = useCalculationsWorkspace();

  const groupSelector = workspace.shouldShowGroupSelector ? (
    <Select
      value={workspace.selectedMethodId}
      onChange={value => {
        const methodId = typeof value === 'number' ? value : null;
        if (methodId != null) {
          void workspace.handleMethodClick(methodId);
        }
      }}
      className="calculations-page-select"
      style={{ width: 'auto', minWidth: 220 }}
    >
      {workspace.groupMethods.map(method => (
        <Option key={method.id} value={method.id}>
          {method.name}
        </Option>
      ))}
    </Select>
  ) : undefined;

  const leftPanel = (
    <CalculationsMethodsPanel
      isLoading={workspace.isLoadingMethodsList}
      availableMethods={workspace.availableMethods}
      selectedMethodId={workspace.selectedMethodId}
      onMethodClick={methodId => {
        void workspace.handleMethodClick(methodId);
      }}
    />
  );

  const rightPanel = (
    <CalculationsWorkspaceRightPanel
      selectedMethodId={workspace.selectedMethodId}
      currentMethod={workspace.currentMethod}
      methodologyChoiceModalOpen={workspace.methodologyChoiceModalOpen}
      methods={workspace.methods}
      groups={workspace.groups}
      calculationFormPrefill={workspace.calculationFormPrefill}
      groupSelector={groupSelector}
      lastCalculationResult={
        workspace.currentMethod
          ? workspace.lastCalculationResult[workspace.currentMethod.id]
          : undefined
      }
      canExecute={workspace.canExecuteCalculations}
      canSave={workspace.canSaveCalculation}
      onCalculate={workspace.handleCalculate}
      onSave={workspace.canSaveCalculation ? workspace.handleOpenSaveModal : undefined}
      onLaboratoryActivityDateChange={workspace.handleLaboratoryActivityDateChange}
    />
  );

  if (workspace.isLoadingSample) {
    return (
      <Layout
        title="Расчёты"
        bodyClassName="calculations-page"
        contentClassName="calculations-page-content"
      >
        <NavigationBar
          breadcrumbs={workspace.breadcrumbs}
          onBack={workspace.handleBack}
          showBack={true}
        />
        <LoadingCard loading />
      </Layout>
    );
  }

  if (workspace.queryErrorMessage) {
    return (
      <Layout
        title="Ошибка"
        bodyClassName="calculations-page"
        contentClassName="calculations-page-content"
      >
        <NavigationBar
          breadcrumbs={workspace.breadcrumbs}
          onBack={workspace.handleBack}
          showBack={true}
        />
        <div className="calculations-page-error">{workspace.queryErrorMessage}</div>
      </Layout>
    );
  }

  return (
    <Layout
      title={workspace.title}
      bodyClassName="calculations-page"
      contentClassName="calculations-page-content"
    >
      <NavigationBar
        breadcrumbs={workspace.breadcrumbs}
        onBack={workspace.handleBack}
        showBack={true}
      />
      <SplitPanel hideLeft={workspace.isEditMode} leftPanel={leftPanel} rightPanel={rightPanel} />

      {workspace.currentMethod && workspace.savedCalculationResult && workspace.labId != null && (
        <SaveCalculationModal
          open={workspace.isSaveModalOpen}
          onClose={() => workspace.setIsSaveModalOpen(false)}
          onSuccess={() => {
            void workspace.handleSaveSuccess();
          }}
          calculationData={{
            input_data: workspace.savedCalculationResult.input_data,
            result: workspace.savedCalculationResult.result,
            measurement_error: workspace.savedCalculationResult.measurement_error,
            unit: workspace.savedCalculationResult.unit,
          }}
          laboratoryActivityDate={workspace.savedCalculationResult.laboratory_activity_date}
          sampleId={workspace.sampleIdNum}
          laboratoryId={workspace.labId}
          departmentId={workspace.deptId}
          researchMethodId={workspace.currentMethod.id}
          researchMethodIncludeDeleted={workspace.editMethodologyVersion === 'stored'}
          equipment_data={workspace.savedCalculationResult.equipment_data}
          editingCalculationId={workspace.isEditMode ? workspace.editCalculationId : undefined}
          existingEquipmentData={workspace.editCalculation?.equipment_data}
          previousExecutorHash={
            workspace.isEditMode ? workspace.editCalculation?.executor : undefined
          }
        />
      )}

      <MethodologyVersionChoiceModal
        open={workspace.methodologyChoiceModalOpen}
        choice={workspace.methodologyChoice ?? null}
        onChooseStored={() => {
          void workspace.handleChooseStoredMethodology();
        }}
        onChooseCurrent={methodId => {
          void workspace.handleChooseCurrentMethodology(methodId);
        }}
        onCancel={workspace.handleMethodologyChoiceCancel}
      />
    </Layout>
  );
};

export default CalculationsWorkspace;
