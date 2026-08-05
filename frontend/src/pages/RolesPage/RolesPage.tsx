import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined } from '@ant-design/icons';
import { ResetFiltersButton } from '../../entities/ResetFiltersButton';
import { LoadingCard } from '../../features/Cards';
import { CreateRoleModal, DeleteRoleModal, EditRoleModal } from '../../features/Modals';
import { ROLE_TYPES } from '../../shared/lib/roleTypeOptions';
import { useRoles } from '../../shared/model/hooks';
import Button from '../../shared/ui/Button';
import Layout from '../../shared/ui/Layout';
import { NavigationBar } from '../../widgets/NavigationBar';
import { RolesTable } from '../../widgets/Tables/RolesTable';
import type { RoleCatalogItem } from '../../shared/api/roles';
import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table';
import './RolesPage.css';

const RolesPage: React.FC = () => {
  const navigate = useNavigate();
  const roles = useRoles();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RoleCatalogItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: roles.page - 1,
      pageSize: roles.pageSize,
    }),
    [roles.page, roles.pageSize]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(roles.total / roles.pageSize)),
    [roles.total, roles.pageSize]
  );

  const handlePaginationChange = useCallback(
    (updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      if (next.pageSize !== pagination.pageSize) {
        roles.setPageSize(next.pageSize);
      }
      if (next.pageIndex !== pagination.pageIndex) {
        roles.setPage(next.pageIndex + 1);
      }
    },
    [pagination, roles]
  );

  const handleFiltersChange = useCallback(
    (filters: ColumnFiltersState) => {
      const nameFilter = filters.find(filter => filter.id === 'name');
      const roleTypeFilter = filters.find(filter => filter.id === 'role_type');
      const nameValue =
        nameFilter && typeof nameFilter.value === 'string' ? nameFilter.value.trim() : '';
      const roleTypeRaw =
        roleTypeFilter && typeof roleTypeFilter.value === 'string'
          ? roleTypeFilter.value.trim()
          : '';
      const roleTypeValue = ROLE_TYPES.find(item => item.value === roleTypeRaw)?.value;

      roles.setFilters({
        search: nameValue || undefined,
        name: nameValue || undefined,
        role_type: roleTypeValue,
      });
      roles.setPage(1);
    },
    [roles]
  );

  const handleSortingChange = useCallback(
    (sortingState: SortingState) => {
      if (sortingState.length > 0) {
        const sort = sortingState[0];
        roles.setSorting({
          sort_by: sort.id,
          sort_order: sort.desc ? 'desc' : 'asc',
        });
      } else {
        roles.setSorting(undefined);
      }
      roles.setPage(1);
    },
    [roles]
  );

  const handleEdit = useCallback(
    (id: number) => {
      const item = roles.data.find(entry => entry.id === id) || null;
      setSelectedItem(item);
      setIsEditModalOpen(true);
    },
    [roles.data]
  );

  const handleDelete = useCallback(
    (id: number) => {
      const item = roles.data.find(entry => entry.id === id) || null;
      setSelectedItem(item);
      setIsDeleteModalOpen(true);
    },
    [roles.data]
  );

  const handleConfigure = useCallback(
    (id: number) => {
      navigate(`/roles/${id}/permissions`);
    },
    [navigate]
  );

  const handleModalSuccess = useCallback(() => {
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setIsDeleteModalOpen(false);
    setSelectedItem(null);
    roles.refetch();
  }, [roles]);

  return (
    <Layout title="Роли">
      <NavigationBar
        breadcrumbs={[{ label: 'Главная', onClick: () => navigate('/') }, { label: 'Роли' }]}
        onBack={() => navigate('/')}
        showBack
      />

      <LoadingCard loading={roles.isLoading} />

      <div className="roles-page-container">
        <div className="roles-page-header">
          <div className="roles-page-header-left">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Добавить роль
            </Button>
          </div>
          <div className="roles-page-header-right">
            <ResetFiltersButton
              onReset={() => {
                roles.setFilters(undefined);
                roles.setSorting(undefined);
                roles.setPage(1);
              }}
            />
          </div>
        </div>

        <div className="roles-page-table">
          <RolesTable
            data={roles.data}
            loading={roles.isLoading}
            pagination={pagination}
            totalPages={totalPages}
            totalRecords={roles.total}
            onPaginationChange={handlePaginationChange}
            onFiltersChange={handleFiltersChange}
            onSortingChange={handleSortingChange}
            sorting={
              roles.sorting?.sort_by
                ? [
                    {
                      id: roles.sorting.sort_by,
                      desc: roles.sorting.sort_order === 'desc',
                    },
                  ]
                : []
            }
            onEdit={handleEdit}
            onDelete={handleDelete}
            onConfigure={handleConfigure}
          />
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateRoleModal
          open={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleModalSuccess}
        />
      )}

      {isEditModalOpen && selectedItem && (
        <EditRoleModal
          open={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedItem(null);
          }}
          onSuccess={handleModalSuccess}
          role={selectedItem}
        />
      )}

      {isDeleteModalOpen && (
        <DeleteRoleModal
          open={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedItem(null);
          }}
          onSuccess={handleModalSuccess}
          role={selectedItem}
        />
      )}
    </Layout>
  );
};

export default RolesPage;
