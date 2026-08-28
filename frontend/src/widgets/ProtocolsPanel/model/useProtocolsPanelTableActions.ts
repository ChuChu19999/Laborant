import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGenerateProtocolExcel, type Protocol, type ProtocolFilters } from '@/entities/Protocol';
import { buildProtocolsColumnFilters } from '../lib/buildProtocolsColumnFilters';
import { columnFiltersToProtocolFilters } from '../lib/columnFiltersToProtocolFilters';
import type { Department } from '@/entities/Department';
import type { Laboratory } from '@/entities/Laboratory';
import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table';

type ProtocolsListApi = {
  data: Protocol[];
  total: number;
  page: number;
  pageSize: number;
  sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' };
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setFilters: (filters: ProtocolFilters | undefined) => void;
  setSorting: (sorting: { sort_by?: string; sort_order?: 'asc' | 'desc' } | undefined) => void;
};

type UseProtocolsPanelTableActionsParams = {
  labId?: number;
  deptId?: number;
  protocols: ProtocolsListApi;
  laboratory?: Laboratory;
  departments?: Department[];
  searchParams: URLSearchParams;
};

/** Пагинация, фильтры, сортировка, навигация и breadcrumbs панели протоколов. */
export const useProtocolsPanelTableActions = ({
  labId,
  deptId,
  protocols,
  laboratory,
  departments,
  searchParams,
}: UseProtocolsPanelTableActionsParams) => {
  const navigate = useNavigate();
  const location = useLocation();
  const generateProtocolExcel = useGenerateProtocolExcel();
  const [tableKey, setTableKey] = useState(0);

  const initialColumnFilters = useMemo(
    () => buildProtocolsColumnFilters(searchParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при монтировании / remount таблицы
    [tableKey]
  );

  const rowData = protocols.data ?? [];
  const totalRecords = protocols.total ?? 0;

  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: protocols.page - 1,
      pageSize: protocols.pageSize,
    }),
    [protocols.page, protocols.pageSize]
  );

  const totalPages = Math.ceil(totalRecords / protocols.pageSize);

  const tableSorting: SortingState = protocols.sorting
    ? [
        {
          id: protocols.sorting.sort_by || 'created_at',
          desc: protocols.sorting.sort_order === 'desc',
        },
      ]
    : [];

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
      protocols.setFilters(columnFiltersToProtocolFilters(columnFilters));
      protocols.setPage(1);
    },
    [protocols]
  );

  const handleSortingChange = useCallback(
    (sortingState: SortingState): void => {
      const sort = sortingState[0];
      if (sort) {
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

  const handleGenerateExcel = useCallback(
    async (protocolId: number) => {
      const { blob, filename } = await generateProtocolExcel.mutateAsync(protocolId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
    [generateProtocolExcel]
  );

  const handleLaboratoryClick = (item: Laboratory) => {
    void navigate(`/protocols/laboratory/${item.id}`);
  };

  const handleDepartmentClick = (item: Department) => {
    void navigate(`/protocols/laboratory/${labId}/department/${item.id}`);
  };

  const handleBack = () => {
    if (deptId && departments && departments.length > 0) {
      void navigate(`/protocols/laboratory/${labId}`);
    } else {
      void navigate('/protocols');
    }
  };

  const handleResetFilters = () => {
    protocols.setFilters(undefined);
    protocols.setSorting(undefined);
    protocols.setPage(1);
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
        label: 'Протоколы',
        onClick: () => {
          void navigate('/protocols');
        },
      },
    ];

    if (laboratory) {
      items.push({
        label: laboratory.name,
        onClick: deptId
          ? () => {
              void navigate(`/protocols/laboratory/${labId}`);
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
      ? departments.find(d => d.id === deptId)?.name || 'Протоколы'
      : laboratory?.name || 'Протоколы';

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
    handleGenerateExcel,
    handleLaboratoryClick,
    handleDepartmentClick,
    handleBack,
    handleResetFilters,
    navigateHome: () => {
      void navigate('/');
    },
  };
};
