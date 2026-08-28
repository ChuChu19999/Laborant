import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useExportSamples, type Sample, type SampleFilters } from '@/entities/Sample';
import { notify } from '@/shared/lib/notify';
import { buildSamplesColumnFilters } from '../lib/buildSamplesColumnFilters';
import { columnFiltersToSampleFilters } from '../lib/columnFiltersToSampleFilters';
import type { Department } from '@/entities/Department';
import type { Laboratory } from '@/entities/Laboratory';
import type { PaginationState, ColumnFiltersState, SortingState } from '@tanstack/react-table';

type SamplesListApi = {
  data: Sample[];
  total: number;
  page: number;
  pageSize: number;
  filters?: SampleFilters;
  sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' };
  isLoading: boolean;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setFilters: (filters: SampleFilters | undefined) => void;
  setSorting: (sorting: { sort_by?: string; sort_order?: 'asc' | 'desc' } | undefined) => void;
  refetch: () => Promise<unknown>;
};

type UseSamplesPanelTableActionsParams = {
  labId?: number;
  deptId?: number;
  samples: SamplesListApi;
  laboratory?: Laboratory;
  departments?: Department[];
  searchParams: URLSearchParams;
};

export const useSamplesPanelTableActions = ({
  labId,
  deptId,
  samples,
  laboratory,
  departments,
  searchParams,
}: UseSamplesPanelTableActionsParams) => {
  const navigate = useNavigate();
  const location = useLocation();
  const exportSamplesMutation = useExportSamples();
  const [tableKey, setTableKey] = useState(0);

  const initialColumnFilters = useMemo(
    () => buildSamplesColumnFilters(searchParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при монтировании / remount таблицы
    [tableKey]
  );

  const rowData = samples.data;
  const totalRecords = samples.total ?? 0;

  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: samples.page - 1,
      pageSize: samples.pageSize,
    }),
    [samples.page, samples.pageSize]
  );

  const totalPages = Math.ceil(totalRecords / samples.pageSize);

  const tableSorting: SortingState = samples.sorting
    ? [
        {
          id: samples.sorting.sort_by || 'created_at',
          desc: samples.sorting.sort_order === 'desc',
        },
      ]
    : [];

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
      samples.setFilters(columnFiltersToSampleFilters(columnFilters));
      samples.setPage(1);
    },
    [samples]
  );

  const handleSortingChange = useCallback(
    (sortingState: SortingState): void => {
      const sort = sortingState[0];
      if (sort) {
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

  const handleExportTable = useCallback(async () => {
    if (!labId) {
      notify.warning('Выберите лабораторию для экспорта');
      return;
    }

    try {
      const { blob } = await exportSamplesMutation.mutateAsync({
        filters: samples.filters,
        sorting: samples.sorting,
        laboratoryId: labId,
        departmentId: deptId,
      });

      const deptName = departments?.find(department => department.id === deptId)?.name;
      const labName = laboratory?.name;
      const titlePart = (deptName || labName || 'Поступления_проб').replace(/\s+/g, '_');
      const dateStamp = dayjs().format('DD.MM.YYYY_HH-mm');
      const filename = `Поступления_проб_${titlePart}_${dateStamp}.xlsx`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      notify.success('Таблица успешно сохранена');
    } catch {
      notify.error('Не удалось экспортировать таблицу проб');
    }
  }, [
    departments,
    deptId,
    exportSamplesMutation,
    labId,
    laboratory?.name,
    samples.filters,
    samples.sorting,
  ]);

  const handleLaboratoryClick = (item: Laboratory) => {
    void navigate(`/samples/laboratory/${item.id}`);
  };

  const handleDepartmentClick = (item: Department) => {
    void navigate(`/samples/laboratory/${labId}/department/${item.id}`);
  };

  const handleBack = () => {
    if (deptId && departments && departments.length > 0) {
      void navigate(`/samples/laboratory/${labId}`);
    } else {
      void navigate('/samples');
    }
  };

  const handleResetFilters = () => {
    samples.setFilters(undefined);
    samples.setSorting(undefined);
    samples.setPage(1);
    setTableKey(key => key + 1);
    void navigate({ pathname: location.pathname, search: '' }, { replace: true });
  };

  const breadcrumbs = useMemo((): { label: string; onClick?: () => void }[] => {
    const items: { label: string; onClick?: () => void }[] = [
      {
        label: 'Главная',
        onClick: () => {
          void navigate('/');
        },
      },
      {
        label: 'Поступления проб',
        onClick: () => {
          void navigate('/samples');
        },
      },
    ];

    if (laboratory) {
      items.push({
        label: laboratory.name,
        onClick: deptId
          ? () => {
              void navigate(`/samples/laboratory/${labId}`);
            }
          : undefined,
      });
    }

    if (deptId && departments) {
      const department = departments.find(d => d.id === deptId);
      if (department) {
        items.push({ label: department.name });
      }
    }

    return items;
  }, [departments, deptId, labId, laboratory, navigate]);

  const pageTitle =
    deptId && departments
      ? departments.find(d => d.id === deptId)?.name || 'Поступления проб'
      : laboratory?.name || 'Поступления проб';

  return {
    tableKey,
    initialColumnFilters,
    rowData,
    totalRecords,
    pagination,
    totalPages,
    tableSorting,
    pageTitle,
    breadcrumbs,
    isExportPending: exportSamplesMutation.isPending,
    handlePaginationChange,
    handleFiltersChange,
    handleSortingChange,
    handleExportTable,
    handleLaboratoryClick,
    handleDepartmentClick,
    handleBack,
    handleResetFilters,
    navigateHome: () => {
      void navigate('/');
    },
  };
};
