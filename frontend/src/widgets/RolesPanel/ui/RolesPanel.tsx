import { CreateRoleModal } from '@/features/CreateRoleModal';
import { DeleteRoleModal } from '@/features/DeleteRoleModal';
import { EditRoleModal } from '@/features/EditRoleModal';
import { RolesTable } from '@/entities/Role';
import { Button } from '@/shared/ui/Button';
import { PlusOutlined } from '@/shared/ui/icons';
import { Layout } from '@/shared/ui/Layout';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import { ResetFiltersButton } from '@/shared/ui/ResetFiltersButton';
import { useRolesPanel } from '../model/useRolesPanel';
import './RolesPanel.css';

const RolesPanel = () => {
  const { roles, modals, table } = useRolesPanel();

  return (
    <Layout title="Роли">
      <NavigationBar breadcrumbs={table.breadcrumbs} onBack={table.navigateHome} showBack />

      <LoadingCard loading={roles.isLoading} />

      <div className="roles-page-container">
        <div className="roles-page-header">
          <div className="roles-page-header-left">
            <Button type="primary" icon={<PlusOutlined />} onClick={modals.openCreateModal}>
              Добавить роль
            </Button>
          </div>
          <div className="roles-page-header-right">
            <ResetFiltersButton onReset={table.handleResetFilters} />
          </div>
        </div>

        <div className="roles-page-table">
          <RolesTable
            key={table.tableKey}
            data={roles.data}
            loading={roles.isLoading}
            pagination={table.pagination}
            totalPages={table.totalPages}
            totalRecords={table.totalRecords}
            onPaginationChange={table.handlePaginationChange}
            onFiltersChange={table.handleFiltersChange}
            onSortingChange={table.handleSortingChange}
            sorting={table.tableSorting}
            onEdit={modals.handleEdit}
            onDelete={modals.handleDelete}
            onConfigure={table.handleConfigure}
            initialColumnFilters={table.tableKey === 0 ? table.initialColumnFilters : []}
          />
        </div>
      </div>

      {modals.isCreateModalOpen && (
        <CreateRoleModal
          open={modals.isCreateModalOpen}
          onClose={modals.closeCreateModal}
          onSuccess={modals.handleModalSuccess}
        />
      )}

      {modals.isEditModalOpen && modals.selectedItem && (
        <EditRoleModal
          open={modals.isEditModalOpen}
          onClose={modals.closeEditModal}
          onSuccess={modals.handleModalSuccess}
          role={modals.selectedItem}
        />
      )}

      {modals.isDeleteModalOpen && (
        <DeleteRoleModal
          open={modals.isDeleteModalOpen}
          onClose={modals.closeDeleteModal}
          onSuccess={modals.handleModalSuccess}
          role={modals.selectedItem}
        />
      )}
    </Layout>
  );
};

export default RolesPanel;
