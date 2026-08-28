import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildNdNormsColumnFilters } from '../lib/buildNdNormsColumnFilters';
import { columnFiltersToNdNormFilters } from '../lib/columnFiltersToNdNormFilters';
import type { Department } from '@/entities/Department';
import type { Laboratory } from '@/entities/Laboratory';
import type { NdNorm, NdNormFilters } from '@/entities/NdNorm';
import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table';

type NdNormsListApi = {
  data: NdNorm[];
  total: number;
  page: number;
  pageSize: number;
  sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' };
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setFilters: (filters: NdNormFilters | undefined) => void;
  setSorting: (sorting: { sort_by?: string; sort_order?: 'asc' | 'desc' } | undefined) => void;
};

type UseNdNormsPanelTableActionsParams = {
  labId?: number;
  deptId?: number;
  ndNorms: NdNormsListApi;
  laboratory?: Laboratory;
  departments?: Department[];
  searchParams: URLSearchParams;
};

/** Пагинация, фильтры, сортировка, навигация и breadcrumbs панели норм НД. */
export const useNdNormsPanelTableActions = ({
  labId,
  deptId,
  ndNorms,
  laboratory,
  departments,
  searchParams,
}: UseNdNormsPanelTableActionsParams) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [tableKey, setTableKey] = useState(0);

  const initialColumnFilters = useMemo(
    () => buildNdNormsColumnFilters(searchParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при монтировании / remount таблицы
    [tableKey]
  );

  const rowData = ndNorms.data ?? [];
  const totalRecords = ndNorms.total ?? 0;

  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: ndNorms.page - 1,
      pageSize: ndNorms.pageSize,
    }),
    [ndNorms.page, ndNorms.pageSize]
  );

  const totalPages = Math.ceil(totalRecords / ndNorms.pageSize);

  const tableSorting: SortingState = ndNorms.sorting
    ? [
        {
          id: ndNorms.sorting.sort_by || 'name',
          desc: ndNorms.sorting.sort_order === 'desc',
        },
      ]
    : [];

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
      ndNorms.setFilters(columnFiltersToNdNormFilters(columnFilters));
      ndNorms.setPage(1);
    },
    [ndNorms]
  );

  const handleSortingChange = useCallback(
    (sortingState: SortingState): void => {
      const sort = sortingState[0];
      if (sort) {
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

  const handleLaboratoryClick = (item: Laboratory) => {
    void navigate(`/nd-norms/laboratory/${item.id}`);
  };

  const handleDepartmentClick = (item: Department) => {
    void navigate(`/nd-norms/laboratory/${labId}/department/${item.id}`);
  };

  const handleBack = () => {
    if (deptId && departments && departments.length > 0) {
      void navigate(`/nd-norms/laboratory/${labId}`);
    } else {
      void navigate('/nd-norms');
    }
  };

  const handleResetFilters = () => {
    ndNorms.setFilters(undefined);
    ndNorms.setSorting(undefined);
    ndNorms.setPage(1);
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
        label: 'Нормы НД',
        onClick: () => {
          void navigate('/nd-norms');
        },
      },
    ];

    if (laboratory) {
      items.push({
        label: laboratory.name,
        onClick: deptId
          ? () => {
              void navigate(`/nd-norms/laboratory/${labId}`);
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
      ? departments.find(d => d.id === deptId)?.name || 'Нормы НД'
      : laboratory?.name || 'Нормы НД';

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
    handlePaginationChange,
    handleFiltersChange,
    handleSortingChange,
    handleLaboratoryClick,
    handleDepartmentClick,
    handleBack,
    handleResetFilters,
    navigateHome: () => {
      void navigate('/');
    },
  };
};
