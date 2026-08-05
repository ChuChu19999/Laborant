import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined } from '@ant-design/icons';
import { ResetFiltersButton } from '../../entities/ResetFiltersButton';
import { LoadingCard } from '../../features/Cards';
import {
  CreateTestObjectModal,
  DeleteTestObjectModal,
  EditTestObjectModal,
} from '../../features/Modals';
import { useTestObjects } from '../../shared/model/hooks';
import Button from '../../shared/ui/Button';
import Layout from '../../shared/ui/Layout';
import { NavigationBar } from '../../widgets/NavigationBar';
import { TestObjectsTable } from '../../widgets/Tables/TestObjectsTable';
import type { TestObjectCatalogItem } from '../../shared/api/testObjects';
import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table';
import './TestObjectsPage.css';

const TestObjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const testObjects = useTestObjects();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TestObjectCatalogItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: testObjects.page - 1,
      pageSize: testObjects.pageSize,
    }),
    [testObjects.page, testObjects.pageSize]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(testObjects.total / testObjects.pageSize)),
    [testObjects.total, testObjects.pageSize]
  );

  const handlePaginationChange = useCallback(
    (updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      if (next.pageSize !== pagination.pageSize) {
        testObjects.setPageSize(next.pageSize);
      }
      if (next.pageIndex !== pagination.pageIndex) {
        testObjects.setPage(next.pageIndex + 1);
      }
    },
    [pagination, testObjects]
  );

  const handleFiltersChange = useCallback(
    (filters: ColumnFiltersState) => {
      const nameFilter = filters.find(filter => filter.id === 'name');
      const tagFilter = filters.find(filter => filter.id === 'tag');
      const nameValue =
        nameFilter && typeof nameFilter.value === 'string' ? nameFilter.value.trim() : '';
      const tagValue =
        tagFilter && typeof tagFilter.value === 'string' ? tagFilter.value.trim() : '';
      const searchValue = [nameValue, tagValue].filter(Boolean).join(' ').trim();

      testObjects.setFilters({
        search: searchValue || undefined,
        name: nameValue || undefined,
        tag: tagValue || undefined,
      });
      testObjects.setPage(1);
    },
    [testObjects]
  );

  const handleSortingChange = useCallback(
    (sortingState: SortingState) => {
      if (sortingState.length > 0) {
        const sort = sortingState[0];
        testObjects.setSorting({
          sort_by: sort.id,
          sort_order: sort.desc ? 'desc' : 'asc',
        });
      } else {
        testObjects.setSorting(undefined);
      }
      testObjects.setPage(1);
    },
    [testObjects]
  );

  const handleEdit = useCallback(
    (id: number) => {
      const item = testObjects.data.find(entry => entry.id === id) || null;
      setSelectedItem(item);
      setIsEditModalOpen(true);
    },
    [testObjects.data]
  );

  const handleDelete = useCallback(
    (id: number) => {
      const item = testObjects.data.find(entry => entry.id === id) || null;
      setSelectedItem(item);
      setIsDeleteModalOpen(true);
    },
    [testObjects.data]
  );

  const handleModalSuccess = useCallback(() => {
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setIsDeleteModalOpen(false);
    setSelectedItem(null);
    testObjects.refetch();
  }, [testObjects]);

  return (
    <Layout title="Объекты испытаний">
      <NavigationBar
        breadcrumbs={[
          { label: 'Главная', onClick: () => navigate('/') },
          { label: 'Объекты испытаний' },
        ]}
        onBack={() => navigate('/')}
        showBack
      />

      <LoadingCard loading={testObjects.isLoading} />

      <div className="test-objects-page-container">
        <div className="test-objects-page-header">
          <div className="test-objects-page-header-left">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Добавить объект испытаний
            </Button>
          </div>
          <div className="test-objects-page-header-right">
            <ResetFiltersButton
              onReset={() => {
                testObjects.setFilters(undefined);
                testObjects.setSorting(undefined);
                testObjects.setPage(1);
              }}
            />
          </div>
        </div>

        <div className="test-objects-page-table">
          <TestObjectsTable
            data={testObjects.data}
            loading={testObjects.isLoading}
            pagination={pagination}
            totalPages={totalPages}
            totalRecords={testObjects.total}
            onPaginationChange={handlePaginationChange}
            onFiltersChange={handleFiltersChange}
            onSortingChange={handleSortingChange}
            sorting={
              testObjects.sorting?.sort_by
                ? [
                    {
                      id: testObjects.sorting.sort_by,
                      desc: testObjects.sorting.sort_order === 'desc',
                    },
                  ]
                : []
            }
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateTestObjectModal
          open={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleModalSuccess}
        />
      )}

      {isEditModalOpen && selectedItem && (
        <EditTestObjectModal
          open={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedItem(null);
          }}
          onSuccess={handleModalSuccess}
          testObject={selectedItem}
        />
      )}

      {isDeleteModalOpen && (
        <DeleteTestObjectModal
          open={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedItem(null);
          }}
          onSuccess={handleModalSuccess}
          testObject={selectedItem}
        />
      )}
    </Layout>
  );
};

export default TestObjectsPage;
