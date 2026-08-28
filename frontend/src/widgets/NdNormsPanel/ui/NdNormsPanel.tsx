import { useParams } from 'react-router-dom';
import { CreateNdNormModal } from '@/features/CreateNdNormModal';
import { DeleteNdNormModal } from '@/features/DeleteNdNormModal';
import { EditNdNormModal } from '@/features/EditNdNormModal';
import { DepartmentCard } from '@/entities/Department';
import { LaboratoryCard } from '@/entities/Laboratory';
import { NdNormsTable } from '@/entities/NdNorm';
import { Button } from '@/shared/ui/Button';
import { PlusOutlined } from '@/shared/ui/icons';
import { Layout } from '@/shared/ui/Layout';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import { ResetFiltersButton } from '@/shared/ui/ResetFiltersButton';
import { useNdNormsPanel } from '../model/useNdNormsPanel';
import './NdNormsPanel.css';

const NdNormsPanel = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;

  const {
    canAccessFeature,
    canCreateNdNorm,
    canUpdateNdNorm,
    canDeleteNdNorm,
    laboratories,
    departments,
    ndNorms,
    methods,
    isLoadingMethods,
    modals,
    table,
  } = useNdNormsPanel(labId, deptId);

  if (!labId && laboratories?.items) {
    return (
      <Layout title="Нормы НД">
        <NavigationBar
          breadcrumbs={table.breadcrumbs}
          onBack={table.navigateHome}
          showBack={true}
        />
        <div className="nd-norms-page-laboratories">
          <div className="nd-norms-page-laboratories-grid">
            {laboratories.items.map(laboratoryItem => (
              <LaboratoryCard
                key={laboratoryItem.id}
                laboratory={laboratoryItem}
                onClick={table.handleLaboratoryClick}
                showActions={false}
                disabled={!canAccessFeature('nd_norms', 'read', laboratoryItem.id)}
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
        <div className="nd-norms-page-departments">
          <div className="nd-norms-page-departments-grid">
            {departments.map((department, index) => (
              <DepartmentCard
                key={department.id}
                department={department}
                onClick={table.handleDepartmentClick}
                showActions={false}
                iconIndex={index}
                disabled={!canAccessFeature('nd_norms', 'read', labId, department.id)}
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
      <LoadingCard loading={ndNorms.isLoading} />
      <div className="nd-norms-page-container">
        <div className="nd-norms-page-header">
          <div className="nd-norms-page-header-left">
            {canCreateNdNorm && (
              <Button type="primary" onClick={modals.openCreateModal} icon={<PlusOutlined />}>
                Добавить норму
              </Button>
            )}
          </div>
          <div className="nd-norms-page-header-right">
            <ResetFiltersButton onReset={table.handleResetFilters} />
          </div>
        </div>
        <div className="nd-norms-page-table">
          <NdNormsTable
            key={table.tableKey}
            data={table.rowData}
            methods={methods}
            laboratoryId={labId}
            departmentId={deptId}
            loading={ndNorms.isLoading || isLoadingMethods}
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
            canUpdate={canUpdateNdNorm}
            canDelete={canDeleteNdNorm}
          />
        </div>
      </div>

      {modals.isCreateModalOpen && (
        <CreateNdNormModal
          open={modals.isCreateModalOpen}
          onClose={modals.handleCreateModalClose}
          onSuccess={modals.handleCreateSuccess}
          laboratoryId={labId}
          departmentId={deptId}
          methods={methods}
          isLoadingMethods={isLoadingMethods}
        />
      )}

      {modals.isEditModalOpen && modals.selectedNdNorm && (
        <EditNdNormModal
          open={modals.isEditModalOpen}
          onClose={modals.handleEditModalClose}
          onSuccess={modals.handleEditSuccess}
          ndNorm={modals.selectedNdNorm}
          methods={methods}
          isLoadingMethods={isLoadingMethods}
        />
      )}

      {modals.isDeleteModalOpen && (
        <DeleteNdNormModal
          open={modals.isDeleteModalOpen}
          onClose={modals.handleDeleteModalClose}
          onSuccess={modals.handleDeleteConfirm}
          ndNorm={modals.selectedNdNorm}
        />
      )}
    </Layout>
  );
};

export default NdNormsPanel;
