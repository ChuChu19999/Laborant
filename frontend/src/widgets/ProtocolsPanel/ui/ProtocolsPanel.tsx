import { useParams } from 'react-router-dom';
import { CreateProtocolModal } from '@/features/CreateProtocolModal';
import { DeleteProtocolModal } from '@/features/DeleteProtocolModal';
import { EditProtocolModal } from '@/features/EditProtocolModal';
import { DepartmentCard } from '@/entities/Department';
import { LaboratoryCard } from '@/entities/Laboratory';
import { ProtocolsTable } from '@/entities/Protocol';
import { Button } from '@/shared/ui/Button';
import { PlusOutlined } from '@/shared/ui/icons';
import { Layout } from '@/shared/ui/Layout';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import { ResetFiltersButton } from '@/shared/ui/ResetFiltersButton';
import { useProtocolsPanel } from '../model/useProtocolsPanel';
import './ProtocolsPanel.css';

const ProtocolsPanel = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;

  const {
    canAccessFeature,
    canCreateProtocol,
    canUpdateProtocol,
    canDeleteProtocol,
    laboratories,
    departments,
    protocols,
    modals,
    table,
  } = useProtocolsPanel(labId, deptId);

  if (!labId && laboratories?.items) {
    return (
      <Layout title="Протоколы">
        <NavigationBar
          breadcrumbs={table.breadcrumbs}
          onBack={table.navigateHome}
          showBack={true}
        />
        <div className="protocols-page-laboratories">
          <div className="protocols-page-laboratories-grid">
            {laboratories.items.map(laboratoryItem => (
              <LaboratoryCard
                key={laboratoryItem.id}
                laboratory={laboratoryItem}
                onClick={table.handleLaboratoryClick}
                showActions={false}
                disabled={!canAccessFeature('protocols', 'read', laboratoryItem.id)}
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
        <div className="protocols-page-departments">
          <div className="protocols-page-departments-grid">
            {departments.map((department, index) => (
              <DepartmentCard
                key={department.id}
                department={department}
                onClick={table.handleDepartmentClick}
                showActions={false}
                iconIndex={index}
                disabled={!canAccessFeature('protocols', 'read', labId, department.id)}
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
      <LoadingCard loading={protocols.isLoading} />
      <div className="protocols-page-container">
        <div className="protocols-page-header">
          <div className="protocols-page-header-left">
            {canCreateProtocol && (
              <Button type="primary" onClick={modals.openCreateModal} icon={<PlusOutlined />}>
                Добавить протокол
              </Button>
            )}
          </div>
          <div className="protocols-page-header-right">
            <ResetFiltersButton onReset={table.handleResetFilters} />
          </div>
        </div>
        <div className="protocols-page-table">
          <ProtocolsTable
            key={table.tableKey}
            data={table.rowData}
            loading={protocols.isLoading}
            pagination={table.pagination}
            totalPages={table.totalPages}
            totalRecords={table.totalRecords}
            onPaginationChange={table.handlePaginationChange}
            onFiltersChange={table.handleFiltersChange}
            onSortingChange={table.handleSortingChange}
            sorting={table.tableSorting}
            onEdit={modals.handleEdit}
            onDelete={modals.handleDelete}
            onGenerateExcel={table.handleGenerateExcel}
            onCreate={modals.openCreateModal}
            onResetFilters={table.handleResetFilters}
            initialColumnFilters={table.tableKey === 0 ? table.initialColumnFilters : []}
            canUpdate={canUpdateProtocol}
            canDelete={canDeleteProtocol}
            canCreate={canCreateProtocol}
          />
        </div>
      </div>

      {modals.isCreateModalOpen && (
        <CreateProtocolModal
          open={modals.isCreateModalOpen}
          onClose={modals.handleCreateModalClose}
          onSuccess={modals.handleCreateSuccess}
          laboratoryId={labId}
          departmentId={deptId}
        />
      )}

      {modals.isEditModalOpen && modals.selectedProtocol && (
        <EditProtocolModal
          open={modals.isEditModalOpen}
          onClose={modals.handleEditModalClose}
          onSuccess={modals.handleEditSuccess}
          protocol={modals.selectedProtocol}
          laboratoryId={labId}
          departmentId={deptId}
        />
      )}

      {modals.isDeleteModalOpen && (
        <DeleteProtocolModal
          open={modals.isDeleteModalOpen}
          onClose={modals.handleDeleteModalClose}
          onSuccess={modals.handleDeleteConfirm}
          protocol={modals.selectedProtocol}
        />
      )}
    </Layout>
  );
};

export default ProtocolsPanel;
