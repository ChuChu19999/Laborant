import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildEquipmentColumnFilters } from '../lib/buildEquipmentColumnFilters';
import { columnFiltersToEquipmentFilters } from '../lib/columnFiltersToEquipmentFilters';
import type { Department } from '@/entities/Department';
import type { Equipment, EquipmentFilters } from '@/entities/Equipment';
import type { Laboratory } from '@/entities/Laboratory';
import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table';

type EquipmentListApi = {
  data: Equipment[];
  total: number;
  page: number;
  pageSize: number;
  sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' };
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setFilters: (filters: EquipmentFilters | undefined) => void;
  setSorting: (sorting: { sort_by?: string; sort_order?: 'asc' | 'desc' } | undefined) => void;
};

type UseEquipmentPanelTableActionsParams = {
  labId?: number;
  deptId?: number;
  equipment: EquipmentListApi;
  laboratory?: Laboratory;
  departments?: Department[];
  searchParams: URLSearchParams;
};

/** Пагинация, фильтры, сортировка, навигация и breadcrumbs панели приборов. */
export const useEquipmentPanelTableActions = ({
  labId,
  deptId,
  equipment,
  laboratory,
  departments,
  searchParams,
}: UseEquipmentPanelTableActionsParams) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [tableKey, setTableKey] = useState(0);

  const initialColumnFilters = useMemo(
    () => buildEquipmentColumnFilters(searchParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при монтировании / remount таблицы
    [tableKey]
  );

  const rowData = equipment.data ?? [];
  const totalRecords = equipment.total ?? 0;

  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: equipment.page - 1,
      pageSize: equipment.pageSize,
    }),
    [equipment.page, equipment.pageSize]
  );

  const totalPages = Math.ceil(totalRecords / equipment.pageSize);

  const tableSorting: SortingState = equipment.sorting
    ? [
        {
          id: equipment.sorting.sort_by || 'created_at',
          desc: equipment.sorting.sort_order === 'desc',
        },
      ]
    : [];

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
      equipment.setFilters(columnFiltersToEquipmentFilters(columnFilters));
      equipment.setPage(1);
    },
    [equipment]
  );

  const handleSortingChange = useCallback(
    (sortingState: SortingState): void => {
      const sort = sortingState[0];
      if (sort) {
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

  const handleLaboratoryClick = (item: Laboratory) => {
    void navigate(`/equipment/laboratory/${item.id}`);
  };

  const handleDepartmentClick = (item: Department) => {
    void navigate(`/equipment/laboratory/${labId}/department/${item.id}`);
  };

  const handleBack = () => {
    if (deptId && departments && departments.length > 0) {
      void navigate(`/equipment/laboratory/${labId}`);
    } else {
      void navigate('/equipment');
    }
  };

  const handleResetFilters = () => {
    equipment.setFilters(undefined);
    equipment.setSorting(undefined);
    equipment.setPage(1);
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
        label: 'Приборы',
        onClick: () => {
          void navigate('/equipment');
        },
      },
    ];

    if (laboratory) {
      items.push({
        label: laboratory.name,
        onClick: deptId
          ? () => {
              void navigate(`/equipment/laboratory/${labId}`);
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
      ? departments.find(d => d.id === deptId)?.name || 'Приборы'
      : laboratory?.name || 'Приборы';

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
