import { useParams } from 'react-router-dom';
import { CreateEquipmentModal } from '@/features/CreateEquipmentModal';
import { DeleteEquipmentModal } from '@/features/DeleteEquipmentModal';
import { EditEquipmentModal } from '@/features/EditEquipmentModal';
import { DepartmentCard } from '@/entities/Department';
import { EquipmentTable } from '@/entities/Equipment';
import { LaboratoryCard } from '@/entities/Laboratory';
import { Button } from '@/shared/ui/Button';
import { PlusOutlined } from '@/shared/ui/icons';
import { Layout } from '@/shared/ui/Layout';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import { ResetFiltersButton } from '@/shared/ui/ResetFiltersButton';
import { useEquipmentPanel } from '../model/useEquipmentPanel';
import './EquipmentPanel.css';

const EquipmentPanel = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;

  const {
    canAccessFeature,
    canCreateEquipment,
    canUpdateEquipment,
    canDeleteEquipment,
    laboratories,
    departments,
    equipment,
    modals,
    table,
  } = useEquipmentPanel(labId, deptId);

  if (!labId && laboratories?.items) {
    return (
      <Layout title="Приборы">
        <NavigationBar
          breadcrumbs={table.breadcrumbs}
          onBack={table.navigateHome}
          showBack={true}
        />
        <div className="equipment-page-laboratories">
          <div className="equipment-page-laboratories-grid">
            {laboratories.items.map(laboratoryItem => (
              <LaboratoryCard
                key={laboratoryItem.id}
                laboratory={laboratoryItem}
                onClick={table.handleLaboratoryClick}
                showActions={false}
                disabled={!canAccessFeature('equipment', 'read', laboratoryItem.id)}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (labId && !deptId && departments && departments.length > 0) {
    return (
      <Layout title={table.pageTitle}>
        <NavigationBar breadcrumbs={table.breadcrumbs} onBack={table.handleBack} showBack={true} />
        <div className="equipment-page-departments">
          <div className="equipment-page-departments-grid">
            {departments.map((department, index) => (
              <DepartmentCard
                key={department.id}
                department={department}
                onClick={table.handleDepartmentClick}
                showActions={false}
                iconIndex={index}
                disabled={!canAccessFeature('equipment', 'read', labId, department.id)}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={table.pageTitle}>
      <NavigationBar breadcrumbs={table.breadcrumbs} onBack={table.handleBack} showBack={true} />
      <LoadingCard loading={equipment.isLoading} />
      <div className="equipment-page-container">
        <div className="equipment-page-header">
          <div className="equipment-page-header-left">
            {canCreateEquipment && (
              <Button type="primary" onClick={modals.openCreateModal} icon={<PlusOutlined />}>
                Добавить прибор
              </Button>
            )}
          </div>
          <div className="equipment-page-header-right">
            <ResetFiltersButton onReset={table.handleResetFilters} />
          </div>
        </div>
        <div className="equipment-page-table">
          <EquipmentTable
            key={table.tableKey}
            data={table.rowData}
            loading={equipment.isLoading}
            pagination={table.pagination}
            totalPages={table.totalPages}
            totalRecords={table.totalRecords}
            onPaginationChange={table.handlePaginationChange}
            onFiltersChange={table.handleFiltersChange}
            onSortingChange={table.handleSortingChange}
            sorting={table.tableSorting}
            onEdit={modals.handleEdit}
            onDelete={modals.handleDelete}
            initialColumnFilters={table.tableKey === 0 ? table.initialColumnFilters : []}
            canUpdate={canUpdateEquipment}
            canDelete={canDeleteEquipment}
          />
        </div>
      </div>

      {modals.isCreateModalOpen && (
        <CreateEquipmentModal
          open={modals.isCreateModalOpen}
          onClose={modals.handleCreateModalClose}
          onSuccess={modals.handleCreateSuccess}
          laboratoryId={labId}
          departmentId={deptId}
        />
      )}

      {modals.isEditModalOpen && modals.selectedEquipment && (
        <EditEquipmentModal
          open={modals.isEditModalOpen}
          onClose={modals.handleEditModalClose}
          onSuccess={modals.handleEditSuccess}
          equipment={modals.selectedEquipment}
          laboratoryId={labId}
          departmentId={deptId}
        />
      )}

      {modals.isDeleteModalOpen && (
        <DeleteEquipmentModal
          open={modals.isDeleteModalOpen}
          onClose={modals.handleDeleteModalClose}
          onSuccess={modals.handleDeleteConfirm}
          equipment={modals.selectedEquipment}
        />
      )}
    </Layout>
  );
};

export default EquipmentPanel;
