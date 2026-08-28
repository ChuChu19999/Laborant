import { CreateTestObjectModal } from '@/features/CreateTestObjectModal';
import { DeleteTestObjectModal } from '@/features/DeleteTestObjectModal';
import { EditTestObjectModal } from '@/features/EditTestObjectModal';
import { TestObjectsTable } from '@/entities/TestObject';
import { Button } from '@/shared/ui/Button';
import { PlusOutlined } from '@/shared/ui/icons';
import { Layout } from '@/shared/ui/Layout';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import { ResetFiltersButton } from '@/shared/ui/ResetFiltersButton';
import { useTestObjectsPanel } from '../model/useTestObjectsPanel';
import './TestObjectsPanel.css';

const TestObjectsPanel = () => {
  const { testObjects, modals, table } = useTestObjectsPanel();

  return (
    <Layout title="Объекты испытаний">
      <NavigationBar breadcrumbs={table.breadcrumbs} onBack={table.navigateHome} showBack />

      <LoadingCard loading={testObjects.isLoading} />

      <div className="test-objects-page-container">
        <div className="test-objects-page-header">
          <div className="test-objects-page-header-left">
            <Button type="primary" icon={<PlusOutlined />} onClick={modals.openCreateModal}>
              Добавить объект испытаний
            </Button>
          </div>
          <div className="test-objects-page-header-right">
            <ResetFiltersButton onReset={table.handleResetFilters} />
          </div>
        </div>

        <div className="test-objects-page-table">
          <TestObjectsTable
            key={table.tableKey}
            data={testObjects.data}
            loading={testObjects.isLoading}
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
          />
        </div>
      </div>

      {modals.isCreateModalOpen && (
        <CreateTestObjectModal
          open={modals.isCreateModalOpen}
          onClose={modals.closeCreateModal}
          onSuccess={modals.handleModalSuccess}
        />
      )}

      {modals.isEditModalOpen && modals.selectedItem && (
        <EditTestObjectModal
          open={modals.isEditModalOpen}
          onClose={modals.closeEditModal}
          onSuccess={modals.handleModalSuccess}
          testObject={modals.selectedItem}
        />
      )}

      {modals.isDeleteModalOpen && (
        <DeleteTestObjectModal
          open={modals.isDeleteModalOpen}
          onClose={modals.closeDeleteModal}
          onSuccess={modals.handleModalSuccess}
          testObject={modals.selectedItem}
        />
      )}
    </Layout>
  );
};

export default TestObjectsPanel;
