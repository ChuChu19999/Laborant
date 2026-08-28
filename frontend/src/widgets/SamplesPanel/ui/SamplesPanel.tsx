import { useParams } from 'react-router-dom';
import { CreateSampleModal } from '@/features/CreateSampleModal';
import { DeleteSampleModal } from '@/features/DeleteSampleModal';
import { EditSampleModal } from '@/features/EditSampleModal';
import { FillCalculationsModal } from '@/features/FillCalculationsModal';
import { GenerateReportModal } from '@/features/GenerateReportModal';
import { useCan, useScopeAccess } from '@/entities/Role';
import { Layout } from '@/shared/ui/Layout';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import { useSamplesPanelModals } from '../model/useSamplesPanelModals';
import { useSamplesPanelQueries } from '../model/useSamplesPanelQueries';
import { useSamplesPanelQuerySync } from '../model/useSamplesPanelQuerySync';
import { useSamplesPanelTableActions } from '../model/useSamplesPanelTableActions';
import SamplesDepartmentsView from './SamplesDepartmentsView';
import SamplesLaboratoriesView from './SamplesLaboratoriesView';
import SamplesTableSection from './SamplesTableSection';
import './SamplesPanel.css';

const SamplesPanel = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
  const { canAccessFeature } = useScopeAccess();
  const canUpdateSample = useCan('samples', 'update', labId, deptId);
  const canDeleteSample = useCan('samples', 'delete', labId, deptId);
  const canExecuteCalculations = useCan('calculations', 'execute', labId, deptId);

  const { searchParams } = useSamplesPanelQuerySync(labId, deptId);
  const { laboratories, laboratory, departments, samples, isIlninmLaboratory } =
    useSamplesPanelQueries(labId, deptId);
  const modals = useSamplesPanelModals(samples);
  const table = useSamplesPanelTableActions({
    labId,
    deptId,
    samples,
    laboratory,
    departments,
    searchParams,
  });

  if (!labId && laboratories?.items) {
    return (
      <SamplesLaboratoriesView
        breadcrumbs={table.breadcrumbs}
        laboratories={laboratories.items}
        onLaboratoryClick={table.handleLaboratoryClick}
        onBack={table.navigateHome}
        canAccessLaboratory={labIdArg => canAccessFeature('navigation', 'samples', labIdArg)}
      />
    );
  }

  if (labId && !deptId && departments && departments.length > 0) {
    return (
      <SamplesDepartmentsView
        title={laboratory?.name || 'Поступления проб'}
        breadcrumbs={table.breadcrumbs}
        departments={departments}
        laboratoryId={labId}
        onDepartmentClick={table.handleDepartmentClick}
        onBack={table.handleBack}
        canAccessDepartment={(labIdArg, deptIdArg) =>
          canAccessFeature('navigation', 'samples', labIdArg, deptIdArg)
        }
      />
    );
  }

  return (
    <Layout title={table.pageTitle}>
      <NavigationBar breadcrumbs={table.breadcrumbs} onBack={table.handleBack} showBack={true} />
      <LoadingCard loading={samples.isLoading} />
      <SamplesTableSection
        tableKey={table.tableKey}
        rowData={table.rowData}
        isLoading={samples.isLoading}
        pagination={table.pagination}
        totalPages={table.totalPages}
        totalRecords={table.totalRecords}
        laboratoryId={labId}
        departmentId={deptId}
        sorting={table.tableSorting}
        initialColumnFilters={table.initialColumnFilters}
        isIlninmLaboratory={isIlninmLaboratory}
        isExportPending={table.isExportPending}
        canUpdate={canUpdateSample}
        canDelete={canDeleteSample}
        canFillCalculations={canExecuteCalculations}
        onCreate={modals.openCreateModal}
        onGenerateReport={modals.openGenerateReportModal}
        onExportTable={() => {
          void table.handleExportTable();
        }}
        onResetFilters={table.handleResetFilters}
        onPaginationChange={table.handlePaginationChange}
        onFiltersChange={table.handleFiltersChange}
        onSortingChange={table.handleSortingChange}
        onEdit={modals.handleEdit}
        onDelete={modals.handleDelete}
        onFillCalculations={modals.handleFillCalculationsFromTable}
      />

      {modals.isCreateModalOpen && (
        <CreateSampleModal
          open={modals.isCreateModalOpen}
          onClose={modals.handleCreateModalClose}
          onSuccess={modals.handleCreateSuccess}
          laboratoryId={labId}
          departmentId={deptId}
        />
      )}

      {modals.isEditModalOpen && modals.selectedSample && (
        <EditSampleModal
          open={modals.isEditModalOpen}
          onClose={modals.handleEditModalClose}
          onSuccess={modals.handleEditSuccess}
          sample={modals.selectedSample}
          laboratoryId={labId}
          departmentId={deptId}
        />
      )}

      {modals.isFillCalculationsModalOpen && modals.selectedSample && (
        <FillCalculationsModal
          open={modals.isFillCalculationsModalOpen}
          onClose={modals.handleFillCalculationsClose}
          sample={modals.selectedSample}
        />
      )}

      {modals.isDeleteModalOpen && (
        <DeleteSampleModal
          open={modals.isDeleteModalOpen}
          onClose={modals.handleDeleteModalClose}
          onSuccess={modals.handleDeleteConfirm}
          sample={modals.selectedSample}
        />
      )}

      {modals.isGenerateReportModalOpen && labId != null && (
        <GenerateReportModal
          open={modals.isGenerateReportModalOpen}
          onClose={modals.handleGenerateReportModalClose}
          laboratoryId={labId}
          departmentId={deptId}
        />
      )}
    </Layout>
  );
};

export default SamplesPanel;
