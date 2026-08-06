import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ResetFiltersButton } from '../../entities/ResetFiltersButton';
import { LoadingCard } from '../../features/Cards';
import { CreateNdNormModal, EditNdNormModal, DeleteNdNormModal } from '../../features/Modals';
import { laboratoriesApi } from '../../shared/api/laboratories';
import { useCan, useScopeAccess } from '../../shared/lib/permissions';
import { useNdNorms, useResearchMethodsForLab } from '../../shared/model/hooks';
import { useAutoRefetchQuery } from '../../shared/model/lib/useQuery';
import { useQueryStore } from '../../shared/model/stores';
import Button from '../../shared/ui/Button';
import { LaboratoryCard, DepartmentCard } from '../../shared/ui/Cards';
import Layout from '../../shared/ui/Layout';
import { NavigationBar } from '../../widgets/NavigationBar';
import { NdNormsTable } from '../../widgets/Tables/NdNormsTable';
import type { Laboratory, Department } from '../../shared/api/laboratories';
import type { NdNorm, NdNormFilters } from '../../shared/api/ndNorms';
import type { PaginationState, ColumnFiltersState, SortingState } from '@tanstack/react-table';
import type { Dayjs } from 'dayjs';
import './NdNormsPage.css';

const NdNormsPage: React.FC = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const navigate = useNavigate();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
  const { canAccessFeature, canAccessFeatureRoute } = useScopeAccess();
  const canCreateNdNorm = useCan('nd_norms', 'create', labId, deptId);
  const canUpdateNdNorm = useCan('nd_norms', 'update', labId, deptId);
  const canDeleteNdNorm = useCan('nd_norms', 'delete', labId, deptId);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedNdNorm, setSelectedNdNorm] = useState<NdNorm | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const {
    ndNormsQuery,
    setNdNormsLaboratoryId,
    setNdNormsDepartmentId,
    setNdNormsPageSize,
    setNdNormsSorting,
  } = useQueryStore();

  const ndNorms = useNdNorms(labId, deptId);
  const { methods, isLoading: isLoadingMethods } = useResearchMethodsForLab(labId, deptId, !!labId);

  const rowData = ndNorms.data ?? [];
  const totalRecords = ndNorms.total ?? 0;

  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: ndNorms.page - 1,
      pageSize: ndNorms.pageSize,
    }),
    [ndNorms.page, ndNorms.pageSize]
  );

  const totalPages = useMemo(
    () => Math.ceil(totalRecords / ndNorms.pageSize),
    [totalRecords, ndNorms.pageSize]
  );

  const effectiveLabId = labId;
  const effectiveDeptId = deptId;

  const { data: laboratories } = useAutoRefetchQuery<{ items: Laboratory[] }>(
    ['laboratories'],
    () => laboratoriesApi.getLaboratories(),
    {
      enabled: !effectiveLabId,
    }
  );

  const { data: laboratory } = useAutoRefetchQuery<Laboratory>(
    ['laboratory', effectiveLabId],
    () => laboratoriesApi.getLaboratory(effectiveLabId!),
    {
      enabled: !!effectiveLabId,
    }
  );

  const { data: departments } = useAutoRefetchQuery<Department[]>(
    ['departments', 'by-laboratory', effectiveLabId],
    () => laboratoriesApi.getDepartmentsByLaboratory(effectiveLabId!),
    {
      enabled: !!effectiveLabId,
    }
  );

  const previousLabIdRef = useRef<number | undefined>(undefined);
  const previousDeptIdRef = useRef<number | undefined>(undefined);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    const labIdChanged = labId !== previousLabIdRef.current;
    const deptIdChanged = deptId !== previousDeptIdRef.current;

    if (labIdChanged) {
      setNdNormsLaboratoryId(labId);
    }
    if (deptIdChanged) {
      setNdNormsDepartmentId(deptId);
    }

    if (isInitialMountRef.current) {
      if (!ndNormsQuery.pageSize) {
        setNdNormsPageSize(20);
      }
      if (!ndNormsQuery.sorting) {
        setNdNormsSorting({ sort_by: 'name', sort_order: 'asc' });
      }
      isInitialMountRef.current = false;
    }

    previousLabIdRef.current = labId;
    previousDeptIdRef.current = deptId;
  }, [
    labId,
    deptId,
    ndNormsQuery.pageSize,
    ndNormsQuery.sorting,
    setNdNormsLaboratoryId,
    setNdNormsDepartmentId,
    setNdNormsPageSize,
    setNdNormsSorting,
  ]);

  const handleEdit = useCallback(
    (ndNormId: number) => {
      const ndNormItem = ndNorms.data.find(item => item.id === ndNormId);
      if (ndNormItem) {
        setSelectedNdNorm(ndNormItem);
        setIsEditModalOpen(true);
      }
    },
    [ndNorms.data]
  );

  const handleDelete = useCallback(
    (ndNormId: number) => {
      const ndNormItem = ndNorms.data.find(item => item.id === ndNormId);
      if (ndNormItem) {
        setSelectedNdNorm(ndNormItem);
        setIsDeleteModalOpen(true);
      }
    },
    [ndNorms.data]
  );

  const handleCreateModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setIsCreateModalOpen(false);
    ndNorms.refetch();
  }, [ndNorms]);

  const handleDeleteConfirm = useCallback(() => {
    setIsDeleteModalOpen(false);
    setSelectedNdNorm(null);
    ndNorms.refetch();
  }, [ndNorms]);

  const handleEditModalClose = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedNdNorm(null);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedNdNorm(null);
    ndNorms.refetch();
  }, [ndNorms]);

  const handlePaginationChange = useCallback(
    (updater: PaginationState | ((old: PaginationState) => PaginationState)): void => {
      const newPagination = typeof updater === 'function' ? updater(pagination) : updater;

      if (newPagination.pageIndex !== pagination.pageIndex) {
        ndNorms.setPage(newPagination.pageIndex + 1);
      }
      if (newPagination.pageSize !== pagination.pageSize) {
        ndNorms.setPageSize(newPagination.pageSize);
        ndNorms.setPage(1);
      }
    },
    [pagination, ndNorms]
  );

  const handleFiltersChange = useCallback(
    (columnFilters: ColumnFiltersState): void => {
      const newFilters: NdNormFilters = {};

      columnFilters.forEach(filter => {
        const filterValue = filter.value;

        if (filter.id === 'name' && filterValue) {
          newFilters.name = String(filterValue);
        } else if (filter.id === 'test_object' && filterValue) {
          if (Array.isArray(filterValue) && filterValue.length > 0) {
            newFilters.test_objects = filterValue as string[];
          } else if (typeof filterValue === 'string') {
            newFilters.test_object = filterValue;
          }
        } else if (filter.id === 'created_at' && filterValue) {
          if (Array.isArray(filterValue) && filterValue.length === 2) {
            const [start, end] = filterValue as [Dayjs | null, Dayjs | null];
            if (start && dayjs.isDayjs(start)) {
              newFilters.created_at_from = start.format('YYYY-MM-DD');
            }
            if (end && dayjs.isDayjs(end)) {
              newFilters.created_at_to = end.format('YYYY-MM-DD');
            }
          }
        }
      });

      ndNorms.setFilters(newFilters);
      ndNorms.setPage(1);
    },
    [ndNorms]
  );

  const handleSortingChange = useCallback(
    (sortingState: SortingState): void => {
      if (sortingState.length > 0) {
        const sort = sortingState[0];
        ndNorms.setSorting({
          sort_by: sort.id,
          sort_order: sort.desc ? 'desc' : 'asc',
        });
      } else {
        ndNorms.setSorting(undefined);
      }
      ndNorms.setPage(1);
    },
    [ndNorms]
  );

  const handleLaboratoryClick = useCallback(
    (laboratory: Laboratory) => {
      navigate(`/nd-norms/laboratory/${laboratory.id}`);
    },
    [navigate]
  );

  const handleDepartmentClick = useCallback(
    (department: Department) => {
      navigate(`/nd-norms/laboratory/${effectiveLabId}/department/${department.id}`);
    },
    [navigate, effectiveLabId]
  );

  const handleBack = useCallback(() => {
    if (effectiveDeptId && departments && departments.length > 0) {
      navigate(`/nd-norms/laboratory/${effectiveLabId}`);
    } else {
      navigate('/nd-norms');
    }
  }, [effectiveDeptId, departments, effectiveLabId, navigate]);

  const getBreadcrumbs = (): Array<{ label: string; onClick?: () => void }> => {
    const breadcrumbs: Array<{ label: string; onClick?: () => void }> = [
      { label: 'Главная', onClick: () => navigate('/') },
      { label: 'Нормы НД', onClick: () => navigate('/nd-norms') },
    ];

    if (laboratory) {
      breadcrumbs.push({
        label: laboratory.name,
        onClick: effectiveDeptId
          ? () => navigate(`/nd-norms/laboratory/${effectiveLabId}`)
          : undefined,
      });
    }

    if (effectiveDeptId && departments) {
      const department = departments.find(d => d.id === effectiveDeptId);
      if (department) {
        breadcrumbs.push({ label: department.name });
      }
    }

    return breadcrumbs;
  };

  if (!canAccessFeatureRoute('nd_norms', 'read', effectiveLabId, effectiveDeptId)) {
    return <Navigate to="/403" replace />;
  }

  if (!effectiveLabId && laboratories?.items) {
    return (
      <Layout title="Нормы НД">
        <NavigationBar
          breadcrumbs={getBreadcrumbs()}
          onBack={() => navigate('/')}
          showBack={true}
        />
        <div className="nd-norms-page-laboratories">
          <div className="nd-norms-page-laboratories-grid">
            {laboratories.items.map(laboratory => (
              <LaboratoryCard
                key={laboratory.id}
                laboratory={laboratory}
                onClick={handleLaboratoryClick}
                showActions={false}
                disabled={!canAccessFeature('nd_norms', 'read', laboratory.id)}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (effectiveLabId && !effectiveDeptId && departments && departments.length > 0) {
    const laboratoryName = laboratory?.name || 'Нормы НД';
    return (
      <Layout title={laboratoryName}>
        <NavigationBar breadcrumbs={getBreadcrumbs()} onBack={handleBack} showBack={true} />
        <div className="nd-norms-page-departments">
          <div className="nd-norms-page-departments-grid">
            {departments.map((department, index) => (
              <DepartmentCard
                key={department.id}
                department={department}
                onClick={handleDepartmentClick}
                showActions={false}
                iconIndex={index}
                disabled={!canAccessFeature('nd_norms', 'read', effectiveLabId, department.id)}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const pageTitle =
    effectiveDeptId && departments
      ? departments.find(d => d.id === effectiveDeptId)?.name || 'Нормы НД'
      : laboratory?.name || 'Нормы НД';

  return (
    <Layout title={pageTitle}>
      <NavigationBar breadcrumbs={getBreadcrumbs()} onBack={handleBack} showBack={true} />
      <LoadingCard loading={ndNorms.isLoading} />
      <div className="nd-norms-page-container">
        <div className="nd-norms-page-header">
          <div className="nd-norms-page-header-left">
            {canCreateNdNorm && (
              <Button
                type="primary"
                onClick={() => setIsCreateModalOpen(true)}
                icon={<PlusOutlined />}
              >
                Добавить норму
              </Button>
            )}
          </div>
          <div className="nd-norms-page-header-right">
            <ResetFiltersButton
              onReset={() => {
                ndNorms.setFilters(undefined);
                ndNorms.setSorting(undefined);
                ndNorms.setPage(1);
              }}
            />
          </div>
        </div>
        <div className="nd-norms-page-table">
          <NdNormsTable
            data={rowData}
            methods={methods}
            laboratoryId={effectiveLabId}
            departmentId={effectiveDeptId}
            loading={ndNorms.isLoading || isLoadingMethods}
            pagination={pagination}
            totalPages={totalPages}
            totalRecords={totalRecords}
            onPaginationChange={handlePaginationChange}
            onFiltersChange={handleFiltersChange}
            onSortingChange={handleSortingChange}
            sorting={
              ndNorms.sorting
                ? [
                    {
                      id: ndNorms.sorting.sort_by || 'name',
                      desc: ndNorms.sorting.sort_order === 'desc',
                    },
                  ]
                : []
            }
            onEdit={handleEdit}
            onDelete={handleDelete}
            canUpdate={canUpdateNdNorm}
            canDelete={canDeleteNdNorm}
          />
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateNdNormModal
          open={isCreateModalOpen}
          onClose={handleCreateModalClose}
          onSuccess={handleCreateSuccess}
          laboratoryId={effectiveLabId}
          departmentId={effectiveDeptId}
          methods={methods}
          isLoadingMethods={isLoadingMethods}
        />
      )}

      {isEditModalOpen && selectedNdNorm && (
        <EditNdNormModal
          open={isEditModalOpen}
          onClose={handleEditModalClose}
          onSuccess={handleEditSuccess}
          ndNorm={selectedNdNorm}
          methods={methods}
          isLoadingMethods={isLoadingMethods}
        />
      )}

      {isDeleteModalOpen && (
        <DeleteNdNormModal
          open={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedNdNorm(null);
          }}
          onSuccess={handleDeleteConfirm}
          ndNorm={selectedNdNorm}
        />
      )}
    </Layout>
  );
};

export default NdNormsPage;
