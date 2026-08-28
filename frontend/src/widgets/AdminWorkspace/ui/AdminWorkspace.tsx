import { CreateResearchMethodModal } from '@/features/CreateResearchMethodModal';
import { DeleteResearchMethodModal } from '@/features/DeleteResearchMethodModal';
import { EquipmentDefaultModal } from '@/features/EquipmentDefaultModal';
import { SaveCalculationModal } from '@/features/SaveCalculationModal';
import { Select } from '@/shared/ui/FormItems';
import { Layout } from '@/shared/ui/Layout';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import { SplitPanel } from '@/shared/ui/SplitPanel';
import { useAdminWorkspace } from '../model/useAdminWorkspace';
import AdminWorkspaceRightPanel from './AdminWorkspaceRightPanel';
import MethodsPanel from './MethodsPanel/MethodsPanel';
import './AdminWorkspace.css';

const { Option } = Select;

const AdminWorkspace = () => {
  const workspace = useAdminWorkspace();

  const groupSelector = workspace.shouldShowGroupSelector ? (
    <Select
      value={workspace.selectedMethodId}
      onChange={value => {
        const methodId = typeof value === 'number' ? value : null;
        workspace.setSelectedMethodId(methodId);
      }}
      className="admin-page-select"
      style={{ width: 'auto', minWidth: 220 }}
    >
      {workspace.groupMethods.map(method => (
        <Option key={method.id} value={method.id}>
          {method.name === 'Фракционный состав (конденсат)'
            ? 'Конденсат'
            : method.name === 'Фракционный состав (нефть)'
              ? 'Нефть'
              : method.name}
        </Option>
      ))}
    </Select>
  ) : undefined;

  const leftPanel = (
    <MethodsPanel
      methods={workspace.methods}
      displayItems={workspace.displayItems}
      selectedMethodId={workspace.selectedMethodId}
      isLoading={workspace.methodsLoading}
      activeId={workspace.activeId}
      showAddButton={workspace.showAddButton}
      onAddMethod={workspace.handleAddMethod}
      onMethodClick={workspace.handleMethodClick}
      onMethodEdit={workspace.handleEditResearchMethod}
      onMethodDelete={workspace.handleMethodDelete}
      onDragStart={workspace.handleDragStart}
      onDragEnd={event => {
        void workspace.handleDragEnd(event);
      }}
      onDragCancel={workspace.handleDragCancel}
    />
  );

  const rightPanel = (
    <AdminWorkspaceRightPanel
      laboratoryId={workspace.labId}
      departmentId={workspace.deptId}
      registrationNumber={workspace.registrationNumber}
      onRegistrationNumberChange={workspace.setRegistrationNumber}
      isLoadingRegistrationData={workspace.isLoadingRegistrationData}
      onLoadRegistrationData={() => {
        void workspace.handleLoadRegistrationData();
      }}
      onOpenEquipmentModal={workspace.handleOpenEquipmentModal}
      hasNoMethods={workspace.hasNoMethods}
      selectedMethodId={workspace.selectedMethodId}
      methods={workspace.methods}
      groups={workspace.groups}
      groupSelector={groupSelector}
      currentMethod={workspace.currentMethod}
      lastCalculationResult={
        workspace.currentMethod
          ? workspace.lastCalculationResult[workspace.currentMethod.id]
          : undefined
      }
      onCalculate={workspace.handleCalculate}
      onSave={workspace.handleOpenSaveModal}
      onLaboratoryActivityDateChange={workspace.handleLaboratoryActivityDateChange}
      onRegistrationDataLoader={workspace.handleRegistrationDataLoader}
    />
  );

  const canSaveCalculation =
    workspace.currentMethod != null &&
    workspace.savedCalculationResult != null &&
    workspace.labId != null;
  const saveLaboratoryId = workspace.labId;

  return (
    <Layout title="Администрирование">
      <NavigationBar
        breadcrumbs={workspace.breadcrumbs}
        onBack={workspace.handleBack}
        showBack={true}
      />
      <SplitPanel leftPanel={leftPanel} rightPanel={rightPanel} />
      <CreateResearchMethodModal
        open={workspace.isCreateResearchMethodModalOpen}
        onClose={workspace.handleResearchMethodModalClose}
        onSuccess={workspace.handleResearchMethodModalSuccess}
        laboratoryId={workspace.laboratoryIdNum}
        departmentId={workspace.departmentIdNum}
        laboratoryName={workspace.laboratory?.name}
        departmentName={workspace.department?.name}
        editMethodId={workspace.editResearchMethodId}
      />
      {workspace.isDeleteModalOpen && (
        <DeleteResearchMethodModal
          open={workspace.isDeleteModalOpen}
          onClose={workspace.handleDeleteModalClose}
          onSuccess={workspace.handleDeleteSuccess}
          target={workspace.deleteTarget}
        />
      )}
      {workspace.isEquipmentModalOpen && workspace.currentMethod && (
        <EquipmentDefaultModal
          open={workspace.isEquipmentModalOpen}
          onClose={workspace.handleCloseEquipmentModal}
          currentMethod={workspace.currentMethod}
          laboratoryId={workspace.labId}
          departmentId={workspace.deptId}
        />
      )}
      {canSaveCalculation &&
        saveLaboratoryId != null &&
        workspace.currentMethod &&
        workspace.savedCalculationResult && (
          <SaveCalculationModal
            open={workspace.isSaveCalculationModalOpen}
            onClose={() => workspace.setIsSaveCalculationModalOpen(false)}
            onSuccess={workspace.handleSaveSuccess}
            calculationData={{
              input_data: workspace.savedCalculationResult.input_data,
              result: workspace.savedCalculationResult.result,
              measurement_error: workspace.savedCalculationResult.measurement_error,
              unit: workspace.savedCalculationResult.unit,
            }}
            laboratoryActivityDate={workspace.savedCalculationResult.laboratory_activity_date}
            laboratoryId={saveLaboratoryId}
            departmentId={workspace.deptId}
            researchMethodId={workspace.currentMethod.id}
            equipment_data={workspace.savedCalculationResult.equipment_data}
          />
        )}
    </Layout>
  );
};

export default AdminWorkspace;
