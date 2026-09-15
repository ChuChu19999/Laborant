import { useParams } from 'react-router-dom';
import { CreateSampleTypeModal } from '@/features/CreateSampleTypeModal';
import { DeleteSampleTypeModal } from '@/features/DeleteSampleTypeModal';
import { EditSampleTypeModal } from '@/features/EditSampleTypeModal';
import { DepartmentCard } from '@/entities/Department';
import { LaboratoryCard } from '@/entities/Laboratory';
import { Button } from '@/shared/ui/Button';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@/shared/ui/icons';
import { Layout } from '@/shared/ui/Layout';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import { TableEmptyState } from '@/shared/ui/TableEmptyState';
import { useSampleTypesPanel } from '../model/useSampleTypesPanel';
import './SampleTypesPanel.css';

const SampleTypesPanel = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
  const panel = useSampleTypesPanel(labId, deptId);

  if (!labId && panel.laboratories?.items) {
    return (
      <Layout title="Типы проб">
        <NavigationBar breadcrumbs={panel.breadcrumbs} onBack={panel.navigateHome} showBack />
        <div className="sample-types-page-laboratories">
          <div className="sample-types-page-laboratories-grid">
            {panel.laboratories.items.map(laboratoryItem => (
              <LaboratoryCard
                key={laboratoryItem.id}
                laboratory={laboratoryItem}
                onClick={panel.handleLaboratoryClick}
                showActions={false}
                disabled={!panel.canAccessFeature('sample_types', 'read', laboratoryItem.id)}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (labId && !deptId && panel.departments && panel.departments.length > 0) {
    return (
      <Layout title={panel.pageTitle}>
        <NavigationBar breadcrumbs={panel.breadcrumbs} onBack={panel.handleBack} showBack />
        <div className="sample-types-page-departments">
          <div className="sample-types-page-departments-grid">
            {panel.departments.map((department, index) => (
              <DepartmentCard
                key={department.id}
                department={department}
                onClick={panel.handleDepartmentClick}
                showActions={false}
                iconIndex={index}
                disabled={!panel.canAccessFeature('sample_types', 'read', labId, department.id)}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={panel.pageTitle}>
      <NavigationBar breadcrumbs={panel.breadcrumbs} onBack={panel.handleBack} showBack />

      <LoadingCard loading={panel.isLoading} />

      <div className="sample-types-page-container">
        <div className="sample-types-page-header">
          <div className="sample-types-page-header-left">
            {panel.canCreate ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={panel.modals.openCreateModal}>
                Добавить тип пробы
              </Button>
            ) : null}
          </div>
        </div>

        {!panel.isLoading && panel.items.length === 0 ? (
          <TableEmptyState
            title="Здесь будут типы проб"
            description="Добавьте первый тип пробы, чтобы использовать его в поступлениях."
            action={
              panel.canCreate ? (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={panel.modals.openCreateModal}
                >
                  Добавить тип пробы
                </Button>
              ) : null
            }
          />
        ) : null}

        {!panel.isLoading && panel.items.length > 0 ? (
          <ul className="sample-types-list">
            {panel.items.map(item => (
              <li key={item.id} className="sample-types-list-item">
                <span className="sample-types-list-name">{item.name}</span>
                <div className="sample-types-list-actions">
                  {panel.canUpdate ? (
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      className="sample-types-edit-button"
                      onClick={() => panel.modals.handleEdit(item)}
                    />
                  ) : null}
                  {panel.canDelete ? (
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => panel.modals.handleDelete(item)}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {panel.modals.isCreateModalOpen ? (
        <CreateSampleTypeModal
          open={panel.modals.isCreateModalOpen}
          onClose={panel.modals.closeCreateModal}
          onSuccess={panel.modals.handleModalSuccess}
          laboratoryId={labId}
          departmentId={deptId}
        />
      ) : null}

      {panel.modals.isEditModalOpen && panel.modals.selectedItem ? (
        <EditSampleTypeModal
          open={panel.modals.isEditModalOpen}
          onClose={panel.modals.closeEditModal}
          onSuccess={panel.modals.handleModalSuccess}
          sampleType={panel.modals.selectedItem}
        />
      ) : null}

      {panel.modals.isDeleteModalOpen ? (
        <DeleteSampleTypeModal
          open={panel.modals.isDeleteModalOpen}
          onClose={panel.modals.closeDeleteModal}
          onSuccess={panel.modals.handleModalSuccess}
          sampleType={panel.modals.selectedItem}
        />
      ) : null}
    </Layout>
  );
};

export default SampleTypesPanel;
