import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ResetFiltersButton } from '../../entities/ResetFiltersButton';
import { LoadingCard } from '../../features/Cards';
import {
  CreateSampleModal,
  EditSampleModal,
  DeleteSampleModal,
  FillCalculationsModal,
  GenerateReportModal,
} from '../../features/Modals';
import { laboratoriesApi } from '../../shared/api/laboratories';
import { useSamples } from '../../shared/model/hooks';
import { useAutoRefetchQuery } from '../../shared/model/lib/useQuery';
import { useQueryStore } from '../../shared/model/stores';
import Button from '../../shared/ui/Button/Button';
import { LaboratoryCard, DepartmentCard } from '../../shared/ui/Cards';
import Layout from '../../shared/ui/Layout/Layout';
import { NavigationBar } from '../../widgets/NavigationBar';
import { SamplesTable } from '../../widgets/Tables/SamplesTable';
import type { Laboratory, Department } from '../../shared/api/laboratories';
import type { Sample, SampleFilters } from '../../shared/api/samples';
import type { PaginationState, ColumnFiltersState, SortingState } from '@tanstack/react-table';
import type { Dayjs } from 'dayjs';
import './SamplesPage.css';

const SamplesPage: React.FC = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFillCalculationsModalOpen, setIsFillCalculationsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isGenerateReportModalOpen, setIsGenerateReportModalOpen] = useState(false);

  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;

  const {
    samplesQuery,
    setSamplesLaboratoryId,
    setSamplesDepartmentId,
    setSamplesPageSize,
    setSamplesSorting,
  } = useQueryStore();

  const samples = useSamples(labId, deptId);

  const rowData = samples.data ?? [];
  const totalRecords = samples.total ?? 0;

  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: samples.page - 1,
      pageSize: samples.pageSize,
    }),
    [samples.page, samples.pageSize]
  );

  const totalPages = useMemo(
    () => Math.ceil(totalRecords / samples.pageSize),
    [totalRecords, samples.pageSize]
  );

  // Используем значения из URL напрямую для более быстрого обновления UI
  // Если в URL есть параметры, используем их; если нет - undefined (не берем из store, чтобы не блокировать навигацию)
  const effectiveLabId = labId;
  const effectiveDeptId = deptId;

  const { data: laboratories } = useAutoRefetchQuery<{ items: Laboratory[] }>(
    ['laboratories'],
    () => laboratoriesApi.getLaboratories(),
    { enabled: true }
  );

  const isIlninmLaboratory =
    effectiveLabId != null &&
    laboratories?.items?.find(l => l.id === effectiveLabId)?.name === 'ИЛНиНМ';

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

    // Обновляем store при изменении labId (включая переход на undefined)
    if (labIdChanged) {
      setSamplesLaboratoryId(labId);
    }
    // Обновляем store при изменении deptId (включая переход на undefined)
    if (deptIdChanged) {
      setSamplesDepartmentId(deptId);
    }

    // Инициализация при первом монтировании
    if (isInitialMountRef.current) {
      if (!samplesQuery.pageSize) {
        setSamplesPageSize(20);
      }
      if (!samplesQuery.sorting) {
        setSamplesSorting({ sort_by: 'created_at', sort_order: 'desc' });
      }
      isInitialMountRef.current = false;
    }

    previousLabIdRef.current = labId;
    previousDeptIdRef.current = deptId;
  }, [
    labId,
    deptId,
    navigate,
    samplesQuery.pageSize,
    samplesQuery.sorting,
    setSamplesLaboratoryId,
    setSamplesDepartmentId,
    setSamplesPageSize,
    setSamplesSorting,
  ]);

  const handleCreateModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setIsCreateModalOpen(false);
    samples.refetch();
  }, [samples]);

  const handleEdit = useCallback(
    (sampleId: number) => {
      const sample = samples.data.find(s => s.id === sampleId);
      if (sample) {
        setSelectedSample(sample);
        setIsEditModalOpen(true);
      }
    },
    [samples.data]
  );

  const handleDelete = useCallback(
    (sampleId: number) => {
      const sample = samples.data.find(s => s.id === sampleId);
      if (sample) {
        setSelectedSample(sample);
        setIsDeleteModalOpen(true);
      }
    },
    [samples.data]
  );

  const handleDeleteConfirm = useCallback(() => {
    setIsDeleteModalOpen(false);
    setSelectedSample(null);
    samples.refetch();
  }, [samples]);

  const handleEditModalClose = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedSample(null);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedSample(null);
    samples.refetch();
  }, [samples]);

  const handleFillCalculationsFromTable = useCallback(
    (sampleId: number) => {
      const sample = samples.data.find(s => s.id === sampleId);
      if (sample) {
        setSelectedSample(sample);
        setIsFillCalculationsModalOpen(true);
      }
    },
    [samples.data]
  );

  const handleFillCalculationsClose = useCallback(() => {
    setIsFillCalculationsModalOpen(false);
    setSelectedSample(null);
  }, []);

  const handlePaginationChange = useCallback(
    (updater: PaginationState | ((old: PaginationState) => PaginationState)): void => {
      const newPagination = typeof updater === 'function' ? updater(pagination) : updater;

      if (newPagination.pageIndex !== pagination.pageIndex) {
        samples.setPage(newPagination.pageIndex + 1);
      }
      if (newPagination.pageSize !== pagination.pageSize) {
        samples.setPageSize(newPagination.pageSize);
        samples.setPage(1);
      }
    },
    [pagination, samples]
  );

  const handleFiltersChange = useCallback(
    (columnFilters: ColumnFiltersState): void => {
      const newFilters: SampleFilters = {};

      columnFilters.forEach(filter => {
        const filterValue = filter.value;

        if (filter.id === 'registration_number' && filterValue) {
          newFilters.registration_number = String(filterValue);
        } else if (filter.id === 'sample_type' && filterValue) {
          if (Array.isArray(filterValue) && filterValue.length > 0) {
            newFilters.sample_types = filterValue as string[];
          } else if (typeof filterValue === 'string') {
            newFilters.sample_type = filterValue;
          }
        } else if (filter.id === 'test_object' && filterValue) {
          if (Array.isArray(filterValue) && filterValue.length > 0) {
            newFilters.test_objects = filterValue as string[];
          } else if (typeof filterValue === 'string') {
            newFilters.test_object = filterValue;
          }
        } else if (filter.id === 'sampling_location' && filterValue) {
          newFilters.sampling_location = String(filterValue);
        } else if (filter.id === 'protocols' && filterValue) {
          newFilters.protocols = String(filterValue);
        } else if (filter.id === 'added_by' && filterValue) {
          newFilters.added_by = String(filterValue);
        } else if (filter.id === 'sampling_date' && filterValue) {
          if (Array.isArray(filterValue) && filterValue.length === 2) {
            const [start, end] = filterValue as [Dayjs | null, Dayjs | null];
            if (start && dayjs.isDayjs(start)) {
              newFilters.sampling_date_from = start.format('YYYY-MM-DD');
            }
            if (end && dayjs.isDayjs(end)) {
              newFilters.sampling_date_to = end.format('YYYY-MM-DD');
            }
          }
        } else if (filter.id === 'receiving_date' && filterValue) {
          if (Array.isArray(filterValue) && filterValue.length === 2) {
            const [start, end] = filterValue as [Dayjs | null, Dayjs | null];
            if (start && dayjs.isDayjs(start)) {
              newFilters.receiving_date_from = start.format('YYYY-MM-DD');
            }
            if (end && dayjs.isDayjs(end)) {
              newFilters.receiving_date_to = end.format('YYYY-MM-DD');
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

      samples.setFilters(newFilters);
      samples.setPage(1);
    },
    [samples]
  );

  const handleSortingChange = useCallback(
    (sortingState: SortingState): void => {
      if (sortingState.length > 0) {
        const sort = sortingState[0];
        samples.setSorting({
          sort_by: sort.id,
          sort_order: sort.desc ? 'desc' : 'asc',
        });
      } else {
        samples.setSorting(undefined);
      }
      samples.setPage(1);
    },
    [samples]
  );

  const handleLaboratoryClick = useCallback(
    (laboratory: Laboratory) => {
      navigate(`/samples/laboratory/${laboratory.id}`);
    },
    [navigate]
  );

  const handleDepartmentClick = useCallback(
    (department: Department) => {
      navigate(`/samples/laboratory/${effectiveLabId}/department/${department.id}`);
    },
    [navigate, effectiveLabId]
  );

  const handleBack = useCallback(() => {
    if (effectiveDeptId && departments && departments.length > 0) {
      navigate(`/samples/laboratory/${effectiveLabId}`);
    } else {
      navigate('/samples');
    }
  }, [effectiveDeptId, departments, effectiveLabId, navigate]);

  const getBreadcrumbs = (): Array<{ label: string; onClick?: () => void }> => {
    const breadcrumbs: Array<{ label: string; onClick?: () => void }> = [
      { label: 'Главная', onClick: () => navigate('/') },
      { label: 'Пробы', onClick: () => navigate('/samples') },
    ];

    if (effectiveLabId && laboratories?.items) {
      const laboratory = laboratories.items.find(l => l.id === effectiveLabId);
      if (laboratory) {
        breadcrumbs.push({
          label: laboratory.name,
          onClick: effectiveDeptId
            ? () => navigate(`/samples/laboratory/${effectiveLabId}`)
            : undefined,
        });
      }
    }

    if (effectiveDeptId && departments) {
      const department = departments.find(d => d.id === effectiveDeptId);
      if (department) {
        breadcrumbs.push({ label: department.name });
      }
    }

    return breadcrumbs;
  };

  if (!effectiveLabId && laboratories?.items) {
    return (
      <Layout title="Пробы">
        <NavigationBar
          breadcrumbs={getBreadcrumbs()}
          onBack={() => navigate('/')}
          showBack={true}
        />
        <div className="samples-page-laboratories">
          <div className="samples-page-laboratories-grid">
            {laboratories.items.map(laboratory => (
              <LaboratoryCard
                key={laboratory.id}
                laboratory={laboratory}
                onClick={handleLaboratoryClick}
                showActions={false}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (effectiveLabId && !effectiveDeptId && departments && departments.length > 0) {
    const laboratoryName = laboratories?.items.find(l => l.id === effectiveLabId)?.name || 'Пробы';
    return (
      <Layout title={laboratoryName}>
        <NavigationBar breadcrumbs={getBreadcrumbs()} onBack={handleBack} showBack={true} />
        <div className="samples-page-departments">
          <div className="samples-page-departments-grid">
            {departments.map((department, index) => (
              <DepartmentCard
                key={department.id}
                department={department}
                onClick={handleDepartmentClick}
                showActions={false}
                iconIndex={index}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const pageTitle =
    effectiveDeptId && departments
      ? departments.find(d => d.id === effectiveDeptId)?.name || 'Пробы'
      : 'Пробы';
  return (
    <Layout title={pageTitle}>
      <NavigationBar breadcrumbs={getBreadcrumbs()} onBack={handleBack} showBack={true} />
      <LoadingCard loading={samples.isLoading} />
      <div className="samples-page-container">
        <div className="samples-page-header">
          <div className="samples-page-header-left">
            <Button
              type="primary"
              onClick={() => setIsCreateModalOpen(true)}
              icon={<PlusOutlined />}
            >
              Добавить пробу
            </Button>
            {isIlninmLaboratory && (
              <Button
                type="default"
                onClick={() => setIsGenerateReportModalOpen(true)}
                icon={<FileTextOutlined />}
              >
                Сформировать отчёт
              </Button>
            )}
          </div>
          <div className="samples-page-header-right">
            <ResetFiltersButton
              onReset={() => {
                samples.setFilters(undefined);
                samples.setSorting(undefined);
                samples.setPage(1);
              }}
            />
          </div>
        </div>
        <div className="samples-page-table">
          <SamplesTable
            data={rowData}
            loading={samples.isLoading}
            pagination={pagination}
            totalPages={totalPages}
            totalRecords={totalRecords}
            onPaginationChange={handlePaginationChange}
            onFiltersChange={handleFiltersChange}
            onSortingChange={handleSortingChange}
            sorting={
              samples.sorting
                ? [
                    {
                      id: samples.sorting.sort_by || 'created_at',
                      desc: samples.sorting.sort_order === 'desc',
                    },
                  ]
                : []
            }
            onEdit={handleEdit}
            onDelete={handleDelete}
            onFillCalculations={handleFillCalculationsFromTable}
          />
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateSampleModal
          open={isCreateModalOpen}
          onClose={handleCreateModalClose}
          onSuccess={handleCreateSuccess}
          laboratoryId={effectiveLabId}
          departmentId={effectiveDeptId}
        />
      )}

      {isEditModalOpen && selectedSample && (
        <EditSampleModal
          open={isEditModalOpen}
          onClose={handleEditModalClose}
          onSuccess={handleEditSuccess}
          sample={selectedSample}
          laboratoryId={effectiveLabId}
          departmentId={effectiveDeptId}
        />
      )}

      {isFillCalculationsModalOpen && selectedSample && (
        <FillCalculationsModal
          open={isFillCalculationsModalOpen}
          onClose={handleFillCalculationsClose}
          sample={selectedSample}
        />
      )}

      {isDeleteModalOpen && (
        <DeleteSampleModal
          open={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedSample(null);
          }}
          onSuccess={handleDeleteConfirm}
          sample={selectedSample}
        />
      )}

      {isGenerateReportModalOpen && effectiveLabId != null && (
        <GenerateReportModal
          open={isGenerateReportModalOpen}
          onClose={() => setIsGenerateReportModalOpen(false)}
          laboratoryId={effectiveLabId}
          departmentId={effectiveDeptId}
        />
      )}
    </Layout>
  );
};

export default SamplesPage;
