import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ResetFiltersButton } from '../../entities/ResetFiltersButton';
import { LoadingCard } from '../../features/Cards';
import {
  CreateEquipmentModal,
  EditEquipmentModal,
  DeleteEquipmentModal,
} from '../../features/Modals';
import { laboratoriesApi } from '../../shared/api/laboratories';
import { useCan, useScopeAccess } from '../../shared/lib/permissions';
import { useEquipment } from '../../shared/model/hooks';
import { useAutoRefetchQuery } from '../../shared/model/lib/useQuery';
import { useQueryStore } from '../../shared/model/stores';
import Button from '../../shared/ui/Button';
import { LaboratoryCard, DepartmentCard } from '../../shared/ui/Cards';
import Layout from '../../shared/ui/Layout';
import { NavigationBar } from '../../widgets/NavigationBar';
import { EquipmentTable } from '../../widgets/Tables/EquipmentTable';
import type { Equipment, EquipmentFilters } from '../../shared/api/equipment';
import type { Laboratory, Department } from '../../shared/api/laboratories';
import type { PaginationState, ColumnFiltersState, SortingState } from '@tanstack/react-table';
import type { Dayjs } from 'dayjs';
import './EquipmentPage.css';

const EquipmentPage: React.FC = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const navigate = useNavigate();
  const { canAccessLaboratory, canAccessDepartment, canAccessRouteScope } = useScopeAccess();
  const canCreateEquipment = useCan('equipment', 'create');
  const canUpdateEquipment = useCan('equipment', 'update');
  const canDeleteEquipment = useCan('equipment', 'delete');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;

  const {
    equipmentQuery,
    setEquipmentLaboratoryId,
    setEquipmentDepartmentId,
    setEquipmentPageSize,
    setEquipmentSorting,
  } = useQueryStore();

  const equipment = useEquipment(labId, deptId);

  const rowData = equipment.data ?? [];
  const totalRecords = equipment.total ?? 0;

  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: equipment.page - 1,
      pageSize: equipment.pageSize,
    }),
    [equipment.page, equipment.pageSize]
  );

  const totalPages = useMemo(
    () => Math.ceil(totalRecords / equipment.pageSize),
    [totalRecords, equipment.pageSize]
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
      setEquipmentLaboratoryId(labId);
    }
    if (deptIdChanged) {
      setEquipmentDepartmentId(deptId);
    }

    if (isInitialMountRef.current) {
      if (!equipmentQuery.pageSize) {
        setEquipmentPageSize(20);
      }
      if (!equipmentQuery.sorting) {
        setEquipmentSorting({ sort_by: 'created_at', sort_order: 'desc' });
      }
      isInitialMountRef.current = false;
    }

    previousLabIdRef.current = labId;
    previousDeptIdRef.current = deptId;
  }, [
    labId,
    deptId,
    navigate,
    equipmentQuery.pageSize,
    equipmentQuery.sorting,
    setEquipmentLaboratoryId,
    setEquipmentDepartmentId,
    setEquipmentPageSize,
    setEquipmentSorting,
  ]);

  const handleEdit = useCallback(
    (equipmentId: number) => {
      const equipmentItem = equipment.data.find(e => e.id === equipmentId);
      if (equipmentItem) {
        setSelectedEquipment(equipmentItem);
        setIsEditModalOpen(true);
      }
    },
    [equipment.data]
  );

  const handleDelete = useCallback(
    (equipmentId: number) => {
      const equipmentItem = equipment.data.find(e => e.id === equipmentId);
      if (equipmentItem) {
        setSelectedEquipment(equipmentItem);
        setIsDeleteModalOpen(true);
      }
    },
    [equipment.data]
  );

  const handleCreateModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setIsCreateModalOpen(false);
    equipment.refetch();
  }, [equipment]);

  const handleDeleteConfirm = useCallback(() => {
    setIsDeleteModalOpen(false);
    setSelectedEquipment(null);
    equipment.refetch();
  }, [equipment]);

  const handleEditModalClose = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedEquipment(null);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedEquipment(null);
    equipment.refetch();
  }, [equipment]);

  const handlePaginationChange = useCallback(
    (updater: PaginationState | ((old: PaginationState) => PaginationState)): void => {
      const newPagination = typeof updater === 'function' ? updater(pagination) : updater;

      if (newPagination.pageIndex !== pagination.pageIndex) {
        equipment.setPage(newPagination.pageIndex + 1);
      }
      if (newPagination.pageSize !== pagination.pageSize) {
        equipment.setPageSize(newPagination.pageSize);
        equipment.setPage(1);
      }
    },
    [pagination, equipment]
  );

  const handleFiltersChange = useCallback(
    (columnFilters: ColumnFiltersState): void => {
      const newFilters: EquipmentFilters = {};

      columnFilters.forEach(filter => {
        const filterValue = filter.value;

        if (filter.id === 'name' && filterValue) {
          newFilters.name = String(filterValue);
        } else if (filter.id === 'serial_number' && filterValue) {
          newFilters.serial_number = String(filterValue);
        } else if (filter.id === 'type' && filterValue) {
          if (Array.isArray(filterValue) && filterValue.length > 0) {
            newFilters.types = filterValue as string[];
          } else if (typeof filterValue === 'string') {
            newFilters.type = filterValue;
          }
        } else if (filter.id === 'verification_date' && filterValue) {
          if (Array.isArray(filterValue) && filterValue.length === 2) {
            const [start, end] = filterValue as [Dayjs | null, Dayjs | null];
            if (start && dayjs.isDayjs(start)) {
              newFilters.verification_date_from = start.format('YYYY-MM-DD');
            }
            if (end && dayjs.isDayjs(end)) {
              newFilters.verification_date_to = end.format('YYYY-MM-DD');
            }
          }
        } else if (filter.id === 'verification_end_date' && filterValue) {
          if (Array.isArray(filterValue) && filterValue.length === 2) {
            const [start, end] = filterValue as [Dayjs | null, Dayjs | null];
            if (start && dayjs.isDayjs(start)) {
              newFilters.verification_end_date_from = start.format('YYYY-MM-DD');
            }
            if (end && dayjs.isDayjs(end)) {
              newFilters.verification_end_date_to = end.format('YYYY-MM-DD');
            }
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

      equipment.setFilters(newFilters);
      equipment.setPage(1);
    },
    [equipment]
  );

  const handleSortingChange = useCallback(
    (sortingState: SortingState): void => {
      if (sortingState.length > 0) {
        const sort = sortingState[0];
        equipment.setSorting({
          sort_by: sort.id,
          sort_order: sort.desc ? 'desc' : 'asc',
        });
      } else {
        equipment.setSorting(undefined);
      }
      equipment.setPage(1);
    },
    [equipment]
  );

  const handleLaboratoryClick = useCallback(
    (laboratory: Laboratory) => {
      navigate(`/equipment/laboratory/${laboratory.id}`);
    },
    [navigate]
  );

  const handleDepartmentClick = useCallback(
    (department: Department) => {
      navigate(`/equipment/laboratory/${effectiveLabId}/department/${department.id}`);
    },
    [navigate, effectiveLabId]
  );

  const handleBack = useCallback(() => {
    if (effectiveDeptId && departments && departments.length > 0) {
      navigate(`/equipment/laboratory/${effectiveLabId}`);
    } else {
      navigate('/equipment');
    }
  }, [effectiveDeptId, departments, effectiveLabId, navigate]);

  const getBreadcrumbs = (): Array<{ label: string; onClick?: () => void }> => {
    const breadcrumbs: Array<{ label: string; onClick?: () => void }> = [
      { label: 'Главная', onClick: () => navigate('/') },
      { label: 'Приборы', onClick: () => navigate('/equipment') },
    ];

    if (laboratory) {
      breadcrumbs.push({
        label: laboratory.name,
        onClick: effectiveDeptId
          ? () => navigate(`/equipment/laboratory/${effectiveLabId}`)
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

  if (!canAccessRouteScope(effectiveLabId, effectiveDeptId)) {
    return <Navigate to="/403" replace />;
  }

  if (!effectiveLabId && laboratories?.items) {
    return (
      <Layout title="Приборы">
        <NavigationBar
          breadcrumbs={getBreadcrumbs()}
          onBack={() => navigate('/')}
          showBack={true}
        />
        <div className="equipment-page-laboratories">
          <div className="equipment-page-laboratories-grid">
            {laboratories.items.map(laboratory => (
              <LaboratoryCard
                key={laboratory.id}
                laboratory={laboratory}
                onClick={handleLaboratoryClick}
                showActions={false}
                disabled={!canAccessLaboratory(laboratory.id)}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (effectiveLabId && !effectiveDeptId && departments && departments.length > 0) {
    const laboratoryName = laboratory?.name || 'Приборы';
    return (
      <Layout title={laboratoryName}>
        <NavigationBar breadcrumbs={getBreadcrumbs()} onBack={handleBack} showBack={true} />
        <div className="equipment-page-departments">
          <div className="equipment-page-departments-grid">
            {departments.map((department, index) => (
              <DepartmentCard
                key={department.id}
                department={department}
                onClick={handleDepartmentClick}
                showActions={false}
                iconIndex={index}
                disabled={!canAccessDepartment(effectiveLabId, department.id)}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const pageTitle =
    effectiveDeptId && departments
      ? departments.find(d => d.id === effectiveDeptId)?.name || 'Приборы'
      : laboratory?.name || 'Приборы';
  return (
    <Layout title={pageTitle}>
      <NavigationBar breadcrumbs={getBreadcrumbs()} onBack={handleBack} showBack={true} />
      <LoadingCard loading={equipment.isLoading} />
      <div className="equipment-page-container">
        <div className="equipment-page-header">
          <div className="equipment-page-header-left">
            {canCreateEquipment && (
              <Button
                type="primary"
                onClick={() => setIsCreateModalOpen(true)}
                icon={<PlusOutlined />}
              >
                Добавить прибор
              </Button>
            )}
          </div>
          <div className="equipment-page-header-right">
            <ResetFiltersButton
              onReset={() => {
                equipment.setFilters(undefined);
                equipment.setSorting(undefined);
                equipment.setPage(1);
              }}
            />
          </div>
        </div>
        <div className="equipment-page-table">
          <EquipmentTable
            data={rowData}
            loading={equipment.isLoading}
            pagination={pagination}
            totalPages={totalPages}
            totalRecords={totalRecords}
            onPaginationChange={handlePaginationChange}
            onFiltersChange={handleFiltersChange}
            onSortingChange={handleSortingChange}
            sorting={
              equipment.sorting
                ? [
                    {
                      id: equipment.sorting.sort_by || 'created_at',
                      desc: equipment.sorting.sort_order === 'desc',
                    },
                  ]
                : []
            }
            onEdit={handleEdit}
            onDelete={handleDelete}
            canUpdate={canUpdateEquipment}
            canDelete={canDeleteEquipment}
          />
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateEquipmentModal
          open={isCreateModalOpen}
          onClose={handleCreateModalClose}
          onSuccess={handleCreateSuccess}
          laboratoryId={effectiveLabId}
          departmentId={effectiveDeptId}
        />
      )}

      {isEditModalOpen && selectedEquipment && (
        <EditEquipmentModal
          open={isEditModalOpen}
          onClose={handleEditModalClose}
          onSuccess={handleEditSuccess}
          equipment={selectedEquipment}
          laboratoryId={effectiveLabId}
          departmentId={effectiveDeptId}
        />
      )}

      {isDeleteModalOpen && (
        <DeleteEquipmentModal
          open={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedEquipment(null);
          }}
          onSuccess={handleDeleteConfirm}
          equipment={selectedEquipment}
        />
      )}
    </Layout>
  );
};

export default EquipmentPage;
