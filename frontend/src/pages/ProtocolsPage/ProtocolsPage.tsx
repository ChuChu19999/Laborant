import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { PlusOutlined } from '@ant-design/icons';
import { message } from 'antd';
import dayjs from 'dayjs';
import { ResetFiltersButton } from '../../entities/ResetFiltersButton';
import { LoadingCard } from '../../features/Cards';
import { CreateProtocolModal, EditProtocolModal, DeleteProtocolModal } from '../../features/Modals';
import { laboratoriesApi } from '../../shared/api/laboratories';
import { protocolsApi } from '../../shared/api/protocols';
import { extractErrorMessage } from '../../shared/lib/errors/extractErrorMessage';
import { useCan, useScopeAccess } from '../../shared/lib/permissions';
import { useProtocols } from '../../shared/model/hooks';
import { useAutoRefetchQuery } from '../../shared/model/lib/useQuery';
import { useQueryStore } from '../../shared/model/stores';
import Button from '../../shared/ui/Button';
import { LaboratoryCard, DepartmentCard } from '../../shared/ui/Cards';
import Layout from '../../shared/ui/Layout';
import { NavigationBar } from '../../widgets/NavigationBar';
import { ProtocolsTable } from '../../widgets/Tables/ProtocolsTable';
import type { Laboratory, Department } from '../../shared/api/laboratories';
import type { Protocol, ProtocolFilters } from '../../shared/api/protocols';
import type { PaginationState, ColumnFiltersState, SortingState } from '@tanstack/react-table';
import type { Dayjs } from 'dayjs';
import './ProtocolsPage.css';

const normalizeProtocolSearchValue = (rawValue: string): { number?: string; date?: string } => {
  const value = rawValue.trim();
  if (!value) {
    return {};
  }

  const result: { number?: string; date?: string } = {};

  // Ищем номер в начале строки
  const numberMatch = value.match(/^(\d+)\s*[\\/]/);
  if (numberMatch && numberMatch[1]) {
    result.number = numberMatch[1];
  }

  // Ищем дату в строке (может быть в конце или после "от")
  const dateMatch = value.match(/(\d{2}\.\d{2}\.\d{4})/);
  if (dateMatch && dateMatch[1]) {
    result.date = dateMatch[1];
  }

  // Если ничего не найдено, возвращаем исходное значение как номер
  if (!result.number && !result.date) {
    result.number = value;
  }

  return result;
};

const ProtocolsPage: React.FC = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const navigate = useNavigate();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
  const { canAccessFeature, canAccessFeatureRoute } = useScopeAccess();
  const canCreateProtocol = useCan('protocols', 'create', labId, deptId);
  const canUpdateProtocol = useCan('protocols', 'update', labId, deptId);
  const canDeleteProtocol = useCan('protocols', 'delete', labId, deptId);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const {
    protocolsQuery,
    setProtocolsLaboratoryId,
    setProtocolsDepartmentId,
    setProtocolsPageSize,
    setProtocolsSorting,
  } = useQueryStore();

  const protocols = useProtocols(labId, deptId);

  const rowData = protocols.data ?? [];
  const totalRecords = protocols.total ?? 0;

  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: protocols.page - 1,
      pageSize: protocols.pageSize,
    }),
    [protocols.page, protocols.pageSize]
  );

  const totalPages = useMemo(
    () => Math.ceil(totalRecords / protocols.pageSize),
    [totalRecords, protocols.pageSize]
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
      setProtocolsLaboratoryId(labId);
    }
    if (deptIdChanged) {
      setProtocolsDepartmentId(deptId);
    }

    if (isInitialMountRef.current) {
      if (!protocolsQuery.pageSize) {
        setProtocolsPageSize(20);
      }
      if (!protocolsQuery.sorting) {
        setProtocolsSorting({ sort_by: 'created_at', sort_order: 'desc' });
      }
      isInitialMountRef.current = false;
    }

    previousLabIdRef.current = labId;
    previousDeptIdRef.current = deptId;
  }, [
    labId,
    deptId,
    navigate,
    protocolsQuery.pageSize,
    protocolsQuery.sorting,
    setProtocolsLaboratoryId,
    setProtocolsDepartmentId,
    setProtocolsPageSize,
    setProtocolsSorting,
  ]);

  const handleEdit = useCallback(
    (protocolId: number) => {
      const protocol = protocols.data.find(p => p.id === protocolId);
      if (protocol) {
        setSelectedProtocol(protocol);
        setIsEditModalOpen(true);
      }
    },
    [protocols.data]
  );

  const handleDelete = useCallback(
    (protocolId: number) => {
      const protocol = protocols.data.find(p => p.id === protocolId);
      if (protocol) {
        setSelectedProtocol(protocol);
        setIsDeleteModalOpen(true);
      }
    },
    [protocols.data]
  );

  const handleCreateModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setIsCreateModalOpen(false);
    protocols.refetch();
  }, [protocols]);

  const handleDeleteConfirm = useCallback(() => {
    setIsDeleteModalOpen(false);
    setSelectedProtocol(null);
    protocols.refetch();
  }, [protocols]);

  const handleEditModalClose = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedProtocol(null);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedProtocol(null);
    protocols.refetch();
  }, [protocols]);

  const handleGenerateExcel = useCallback(async (protocolId: number) => {
    try {
      const { blob, filename } = await protocolsApi.generateProtocolExcel(protocolId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('Протокол успешно сформирован');
    } catch (error) {
      const errorMessage = extractErrorMessage(error, 'Ошибка при формировании протокола');
      message.error(errorMessage);
    }
  }, []);

  const handlePaginationChange = useCallback(
    (updater: PaginationState | ((old: PaginationState) => PaginationState)): void => {
      const newPagination = typeof updater === 'function' ? updater(pagination) : updater;

      if (newPagination.pageIndex !== pagination.pageIndex) {
        protocols.setPage(newPagination.pageIndex + 1);
      }
      if (newPagination.pageSize !== pagination.pageSize) {
        protocols.setPageSize(newPagination.pageSize);
        protocols.setPage(1);
      }
    },
    [pagination, protocols]
  );

  const handleFiltersChange = useCallback(
    (columnFilters: ColumnFiltersState): void => {
      const newFilters: ProtocolFilters = {};

      columnFilters.forEach(filter => {
        const filterValue = filter.value;

        if (filter.id === 'test_protocol_number' && filterValue) {
          const normalized = normalizeProtocolSearchValue(String(filterValue));
          if (normalized.number) {
            newFilters.test_protocol_number = normalized.number;
          }
          if (normalized.date) {
            // Конвертируем дату из DD.MM.YYYY в YYYY-MM-DD для бэкенда
            const [day, month, year] = normalized.date.split('.');
            newFilters.test_protocol_date_search = `${year}-${month}-${day}`;
          }
        } else if (filter.id === 'sampling_act_number' && filterValue) {
          newFilters.sampling_act_number = String(filterValue);
        } else if (filter.id === 'samples_data' && filterValue) {
          newFilters.search_samples = String(filterValue);
        } else if (filter.id === 'test_protocol_date' && filterValue) {
          if (Array.isArray(filterValue) && filterValue.length === 2) {
            const [start, end] = filterValue as [Dayjs | null, Dayjs | null];
            if (start && dayjs.isDayjs(start)) {
              newFilters.test_protocol_date_from = start.format('YYYY-MM-DD');
            }
            if (end && dayjs.isDayjs(end)) {
              newFilters.test_protocol_date_to = end.format('YYYY-MM-DD');
            }
          }
        } else if (
          filter.id === 'is_accredited' &&
          filterValue !== null &&
          filterValue !== undefined
        ) {
          newFilters.is_accredited = Boolean(filterValue);
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

      protocols.setFilters(newFilters);
      protocols.setPage(1);
    },
    [protocols]
  );

  const handleSortingChange = useCallback(
    (sortingState: SortingState): void => {
      if (sortingState.length > 0) {
        const sort = sortingState[0];
        protocols.setSorting({
          sort_by: sort.id,
          sort_order: sort.desc ? 'desc' : 'asc',
        });
      } else {
        protocols.setSorting(undefined);
      }
      protocols.setPage(1);
    },
    [protocols]
  );

  const handleLaboratoryClick = useCallback(
    (laboratory: Laboratory) => {
      navigate(`/protocols/laboratory/${laboratory.id}`);
    },
    [navigate]
  );

  const handleDepartmentClick = useCallback(
    (department: Department) => {
      navigate(`/protocols/laboratory/${effectiveLabId}/department/${department.id}`);
    },
    [navigate, effectiveLabId]
  );

  const handleBack = useCallback(() => {
    if (effectiveDeptId && departments && departments.length > 0) {
      navigate(`/protocols/laboratory/${effectiveLabId}`);
    } else {
      navigate('/protocols');
    }
  }, [effectiveDeptId, departments, effectiveLabId, navigate]);

  const getBreadcrumbs = (): Array<{ label: string; onClick?: () => void }> => {
    const breadcrumbs: Array<{ label: string; onClick?: () => void }> = [
      { label: 'Главная', onClick: () => navigate('/') },
      { label: 'Протоколы', onClick: () => navigate('/protocols') },
    ];

    if (laboratory) {
      breadcrumbs.push({
        label: laboratory.name,
        onClick: effectiveDeptId
          ? () => navigate(`/protocols/laboratory/${effectiveLabId}`)
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

  if (!canAccessFeatureRoute('protocols', 'read', effectiveLabId, effectiveDeptId)) {
    return <Navigate to="/403" replace />;
  }

  if (!effectiveLabId && laboratories?.items) {
    return (
      <Layout title="Протоколы">
        <NavigationBar
          breadcrumbs={getBreadcrumbs()}
          onBack={() => navigate('/')}
          showBack={true}
        />
        <div className="protocols-page-laboratories">
          <div className="protocols-page-laboratories-grid">
            {laboratories.items.map(laboratory => (
              <LaboratoryCard
                key={laboratory.id}
                laboratory={laboratory}
                onClick={handleLaboratoryClick}
                showActions={false}
                disabled={!canAccessFeature('protocols', 'read', laboratory.id)}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (effectiveLabId && !effectiveDeptId && departments && departments.length > 0) {
    const laboratoryName = laboratory?.name || 'Протоколы';
    return (
      <Layout title={laboratoryName}>
        <NavigationBar breadcrumbs={getBreadcrumbs()} onBack={handleBack} showBack={true} />
        <div className="protocols-page-departments">
          <div className="protocols-page-departments-grid">
            {departments.map((department, index) => (
              <DepartmentCard
                key={department.id}
                department={department}
                onClick={handleDepartmentClick}
                showActions={false}
                iconIndex={index}
                disabled={!canAccessFeature('protocols', 'read', effectiveLabId, department.id)}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const pageTitle =
    effectiveDeptId && departments
      ? departments.find(d => d.id === effectiveDeptId)?.name || 'Протоколы'
      : laboratory?.name || 'Протоколы';
  return (
    <Layout title={pageTitle}>
      <NavigationBar breadcrumbs={getBreadcrumbs()} onBack={handleBack} showBack={true} />
      <LoadingCard loading={protocols.isLoading} />
      <div className="protocols-page-container">
        <div className="protocols-page-header">
          <div className="protocols-page-header-left">
            {canCreateProtocol && (
              <Button
                type="primary"
                onClick={() => setIsCreateModalOpen(true)}
                icon={<PlusOutlined />}
              >
                Добавить протокол
              </Button>
            )}
          </div>
          <div className="protocols-page-header-right">
            <ResetFiltersButton
              onReset={() => {
                protocols.setFilters(undefined);
                protocols.setSorting(undefined);
                protocols.setPage(1);
              }}
            />
          </div>
        </div>
        <div className="protocols-page-table">
          <ProtocolsTable
            data={rowData}
            loading={protocols.isLoading}
            pagination={pagination}
            totalPages={totalPages}
            totalRecords={totalRecords}
            onPaginationChange={handlePaginationChange}
            onFiltersChange={handleFiltersChange}
            onSortingChange={handleSortingChange}
            sorting={
              protocols.sorting
                ? [
                    {
                      id: protocols.sorting.sort_by || 'created_at',
                      desc: protocols.sorting.sort_order === 'desc',
                    },
                  ]
                : []
            }
            onEdit={handleEdit}
            onDelete={handleDelete}
            onGenerateExcel={handleGenerateExcel}
            onCreate={() => setIsCreateModalOpen(true)}
            onResetFilters={() => {
              protocols.setFilters(undefined);
              protocols.setSorting(undefined);
              protocols.setPage(1);
            }}
            canUpdate={canUpdateProtocol}
            canDelete={canDeleteProtocol}
            canCreate={canCreateProtocol}
          />
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateProtocolModal
          open={isCreateModalOpen}
          onClose={handleCreateModalClose}
          onSuccess={handleCreateSuccess}
          laboratoryId={effectiveLabId}
          departmentId={effectiveDeptId}
        />
      )}

      {isEditModalOpen && selectedProtocol && (
        <EditProtocolModal
          open={isEditModalOpen}
          onClose={handleEditModalClose}
          onSuccess={handleEditSuccess}
          protocol={selectedProtocol}
          laboratoryId={effectiveLabId}
          departmentId={effectiveDeptId}
        />
      )}

      {isDeleteModalOpen && (
        <DeleteProtocolModal
          open={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedProtocol(null);
          }}
          onSuccess={handleDeleteConfirm}
          protocol={selectedProtocol}
        />
      )}
    </Layout>
  );
};

export default ProtocolsPage;
