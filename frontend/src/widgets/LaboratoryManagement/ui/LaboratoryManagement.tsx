import { CreateDepartmentModal } from '@/features/CreateDepartmentModal';
import { CreateLaboratoryModal } from '@/features/CreateLaboratoryModal';
import { DeleteDepartmentModal } from '@/features/DeleteDepartmentModal';
import { DeleteLaboratoryModal } from '@/features/DeleteLaboratoryModal';
import { EditDepartmentModal } from '@/features/EditDepartmentModal';
import { EditLaboratoryModal } from '@/features/EditLaboratoryModal';
import { EditProtocolTemplateModal } from '@/features/EditProtocolTemplateModal';
import { EditReportTemplateModal } from '@/features/EditReportTemplateModal';
import { SelectionConditionsModal } from '@/features/SelectionConditionsModal';
import { AddDepartmentCard, DepartmentCard, type Department } from '@/entities/Department';
import { AddLaboratoryCard, LaboratoryCard, type Laboratory } from '@/entities/Laboratory';
import { BarChartOutlined } from '@/shared/ui/icons';
import { Layout } from '@/shared/ui/Layout';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import { useLaboratoryManagement } from '../model/useLaboratoryManagement';
import './LaboratoryManagement.css';

interface LaboratoryManagementProps {
  onBack: () => void;
}

const LaboratoryManagement = ({ onBack }: LaboratoryManagementProps) => {
  const panel = useLaboratoryManagement(onBack);

  if (panel.isLoading && panel.laboratories.length === 0 && panel.departments.length === 0) {
    return (
      <Layout title="Управление лабораториями">
        <LoadingCard loading={panel.isLoading} />
      </Layout>
    );
  }

  return (
    <Layout title="Управление лабораториями">
      <div className="laboratory-management">
        <NavigationBar
          breadcrumbs={panel.breadcrumbs}
          onBack={panel.viewMode === 'departments' ? panel.handleBack : panel.onBack}
          showBack={true}
        />

        {panel.viewMode === 'laboratories' ? (
          <div className="laboratory-management-laboratories-grid">
            {panel.laboratories.map(laboratory => (
              <LaboratoryCard
                key={laboratory.id}
                laboratory={laboratory}
                onClick={panel.handleLaboratoryClick}
                showActions={true}
                onEdit={panel.handleEdit}
                onDelete={panel.canManageStructure ? panel.handleDeleteClick : undefined}
                disabled={!panel.canAccessFeature('laboratory_management', 'access', laboratory.id)}
                settingsMenuItems={
                  !(laboratory.departments_count && laboratory.departments_count > 0)
                    ? panel.buildSettingsMenuItems({
                        laboratoryId: laboratory.id,
                        entityName: laboratory.name,
                      })
                    : undefined
                }
              />
            ))}
            {panel.canManageStructure && <AddLaboratoryCard onClick={panel.openCreateModal} />}
          </div>
        ) : panel.isLoading && panel.viewMode === 'departments' ? (
          <LoadingCard loading={panel.isLoading} />
        ) : panel.departments.length === 0 ? (
          <div className="empty-departments-choice">
            <div className="empty-departments-content">
              <h2 className="empty-departments-title">В лаборатории нет подразделений</h2>
              <p className="empty-departments-description">Выберите действие для начала работы</p>
              <div className="empty-departments-actions">
                <button
                  className="empty-departments-button calculation-button"
                  onClick={panel.navigateToLaboratoryMethods}
                >
                  <div className="empty-departments-button-content">
                    <BarChartOutlined className="empty-departments-button-icon" />
                    <h3 className="empty-departments-button-text">Добавить метод расчёта</h3>
                  </div>
                </button>
                {panel.canManageStructure && (
                  <AddDepartmentCard
                    text="Добавить первое подразделение"
                    onClick={panel.openCreateDeptModal}
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="laboratory-management-departments-grid">
            {panel.departments.map((department, index) => (
              <DepartmentCard
                key={department.id}
                department={department}
                onClick={panel.handleDepartmentClick}
                showActions={true}
                onEdit={panel.handleEdit}
                onDelete={panel.canManageStructure ? panel.handleDeleteClick : undefined}
                iconIndex={index}
                disabled={
                  !panel.selectedLaboratory ||
                  !panel.canAccessFeature(
                    'laboratory_management',
                    'access',
                    panel.selectedLaboratory.id,
                    department.id
                  )
                }
                settingsMenuItems={
                  panel.selectedLaboratory
                    ? panel.buildSettingsMenuItems({
                        laboratoryId: panel.selectedLaboratory.id,
                        departmentId: department.id,
                        entityName: department.name,
                      })
                    : undefined
                }
              />
            ))}
            {panel.canManageStructure && <AddDepartmentCard onClick={panel.openCreateDeptModal} />}
          </div>
        )}

        <CreateLaboratoryModal
          open={panel.isCreateModalOpen}
          onClose={panel.handleModalClose}
          onSuccess={panel.handleSuccess}
        />

        <EditLaboratoryModal
          open={panel.isEditModalOpen}
          laboratory={
            panel.selectedItem && 'id' in panel.selectedItem
              ? (panel.selectedItem as Laboratory)
              : null
          }
          onClose={panel.handleModalClose}
          onSuccess={panel.handleSuccess}
        />

        <DeleteLaboratoryModal
          open={panel.isDeleteModalOpen}
          laboratory={
            panel.selectedItem && 'id' in panel.selectedItem
              ? (panel.selectedItem as Laboratory)
              : null
          }
          onClose={panel.handleModalClose}
          onSuccess={panel.handleSuccess}
        />

        {panel.selectedLaboratory && (
          <CreateDepartmentModal
            open={panel.isCreateDeptModalOpen}
            laboratoryId={panel.selectedLaboratory.id}
            onClose={panel.handleModalClose}
            onSuccess={panel.handleSuccess}
          />
        )}

        <EditDepartmentModal
          open={panel.isEditDeptModalOpen}
          department={
            panel.selectedItem && 'id' in panel.selectedItem
              ? (panel.selectedItem as Department)
              : null
          }
          onClose={panel.handleModalClose}
          onSuccess={panel.handleSuccess}
        />

        <DeleteDepartmentModal
          open={panel.isDeleteDeptModalOpen}
          department={
            panel.selectedItem && 'id' in panel.selectedItem
              ? (panel.selectedItem as Department)
              : null
          }
          onClose={panel.handleModalClose}
          onSuccess={panel.handleSuccess}
        />

        {panel.isProtocolTemplateModalOpen && panel.settingsScope && (
          <EditProtocolTemplateModal
            open={panel.isProtocolTemplateModalOpen}
            onClose={panel.closeProtocolTemplateModal}
            laboratoryId={panel.settingsScope.laboratoryId}
            departmentId={panel.settingsScope.departmentId}
          />
        )}
        {panel.isReportTemplateModalOpen && panel.settingsScope && (
          <EditReportTemplateModal
            open={panel.isReportTemplateModalOpen}
            onClose={panel.closeReportTemplateModal}
            laboratoryId={panel.settingsScope.laboratoryId}
            departmentId={panel.settingsScope.departmentId}
          />
        )}
        {panel.isSelectionConditionsModalOpen && panel.settingsScope && (
          <SelectionConditionsModal
            open={panel.isSelectionConditionsModalOpen}
            onClose={panel.closeSelectionConditionsModal}
            laboratoryId={panel.settingsScope.laboratoryId}
            departmentId={panel.settingsScope.departmentId}
            entityName={panel.settingsScope.entityName}
          />
        )}
      </div>
    </Layout>
  );
};

export default LaboratoryManagement;
