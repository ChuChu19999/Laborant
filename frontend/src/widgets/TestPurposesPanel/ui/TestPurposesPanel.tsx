import { useParams } from 'react-router-dom';
import { CreateTestPurposeModal } from '@/features/CreateTestPurposeModal';
import { DeleteTestPurposeModal } from '@/features/DeleteTestPurposeModal';
import { EditTestPurposeModal } from '@/features/EditTestPurposeModal';
import { DepartmentCard } from '@/entities/Department';
import { LaboratoryCard } from '@/entities/Laboratory';
import { Button } from '@/shared/ui/Button';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@/shared/ui/icons';
import { Layout } from '@/shared/ui/Layout';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import { TableEmptyState } from '@/shared/ui/TableEmptyState';
import { useTestPurposesPanel } from '../model/useTestPurposesPanel';
import './TestPurposesPanel.css';

const TestPurposesPanel = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
  const panel = useTestPurposesPanel(labId, deptId);

  if (!labId && panel.laboratories?.items) {
    return (
      <Layout title="Цели испытаний">
        <NavigationBar breadcrumbs={panel.breadcrumbs} onBack={panel.navigateHome} showBack />
        <div className="test-purposes-page-laboratories">
          <div className="test-purposes-page-laboratories-grid">
            {panel.laboratories.items.map(laboratoryItem => (
              <LaboratoryCard
                key={laboratoryItem.id}
                laboratory={laboratoryItem}
                onClick={panel.handleLaboratoryClick}
                showActions={false}
                disabled={!panel.canAccessFeature('test_purposes', 'read', laboratoryItem.id)}
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
        <div className="test-purposes-page-departments">
          <div className="test-purposes-page-departments-grid">
            {panel.departments.map((department, index) => (
              <DepartmentCard
                key={department.id}
                department={department}
                onClick={panel.handleDepartmentClick}
                showActions={false}
                iconIndex={index}
                disabled={!panel.canAccessFeature('test_purposes', 'read', labId, department.id)}
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

      <div className="test-purposes-page-container">
        <div className="test-purposes-page-header">
          <div className="test-purposes-page-header-left">
            {panel.canCreate ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={panel.modals.openCreateModal}>
                Добавить цель испытаний
              </Button>
            ) : null}
          </div>
        </div>

        {!panel.isLoading && panel.items.length === 0 ? (
          <TableEmptyState
            title="Здесь будут цели испытаний"
            description="Добавьте первую цель испытаний, чтобы использовать её в поступлениях."
            action={
              panel.canCreate ? (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={panel.modals.openCreateModal}
                >
                  Добавить цель испытаний
                </Button>
              ) : null
            }
          />
        ) : null}

        {!panel.isLoading && panel.items.length > 0 ? (
          <ul className="test-purposes-list">
            {panel.items.map(item => (
              <li key={item.id} className="test-purposes-list-item">
                <span className="test-purposes-list-name">{item.name}</span>
                <div className="test-purposes-list-actions">
                  {panel.canUpdate ? (
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      className="test-purposes-edit-button"
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
        <CreateTestPurposeModal
          open={panel.modals.isCreateModalOpen}
          onClose={panel.modals.closeCreateModal}
          onSuccess={panel.modals.handleModalSuccess}
          laboratoryId={labId}
          departmentId={deptId}
        />
      ) : null}

      {panel.modals.isEditModalOpen && panel.modals.selectedItem ? (
        <EditTestPurposeModal
          open={panel.modals.isEditModalOpen}
          onClose={panel.modals.closeEditModal}
          onSuccess={panel.modals.handleModalSuccess}
          testPurpose={panel.modals.selectedItem}
        />
      ) : null}

      {panel.modals.isDeleteModalOpen ? (
        <DeleteTestPurposeModal
          open={panel.modals.isDeleteModalOpen}
          onClose={panel.modals.closeDeleteModal}
          onSuccess={panel.modals.handleModalSuccess}
          testPurpose={panel.modals.selectedItem}
        />
      ) : null}
    </Layout>
  );
};

export default TestPurposesPanel;
