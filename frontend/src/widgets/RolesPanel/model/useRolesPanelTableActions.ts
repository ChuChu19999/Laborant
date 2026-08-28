import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildRolesColumnFilters } from '../lib/buildRolesColumnFilters';
import { columnFiltersToRoleFilters } from '../lib/columnFiltersToRoleFilters';
import type { RoleFilters } from '@/entities/Role';
import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table';

type RolesListApi = {
  page: number;
  pageSize: number;
  total: number;
  sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' };
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setFilters: (filters: RoleFilters | undefined) => void;
  setSorting: (sorting: { sort_by?: string; sort_order?: 'asc' | 'desc' } | undefined) => void;
};

type UseRolesPanelTableActionsParams = {
  roles: RolesListApi;
  searchParams: URLSearchParams;
};

/** Пагинация, фильтры, сортировка и навигация панели ролей. */
export const useRolesPanelTableActions = ({
  roles,
  searchParams,
}: UseRolesPanelTableActionsParams) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [tableKey, setTableKey] = useState(0);

  const initialColumnFilters = useMemo(
    () => buildRolesColumnFilters(searchParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при монтировании / remount таблицы
    [tableKey]
  );

  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: roles.page - 1,
      pageSize: roles.pageSize,
    }),
    [roles.page, roles.pageSize]
  );

  const totalPages = Math.max(1, Math.ceil(roles.total / roles.pageSize));

  const tableSorting: SortingState = roles.sorting?.sort_by
    ? [
        {
          id: roles.sorting.sort_by,
          desc: roles.sorting.sort_order === 'desc',
        },
      ]
    : [];

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
      roles.setFilters(columnFiltersToRoleFilters(filters));
      roles.setPage(1);
    },
    [roles]
  );

  const handleSortingChange = useCallback(
    (sortingState: SortingState) => {
      const sort = sortingState[0];
      if (sort) {
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

  const handleConfigure = (id: number) => {
    void navigate(`/roles/${id}/permissions`);
  };

  const handleResetFilters = () => {
    roles.setFilters(undefined);
    roles.setSorting(undefined);
    roles.setPage(1);
    setTableKey(key => key + 1);
    void navigate({ pathname: location.pathname, search: '' }, { replace: true });
  };

  const breadcrumbs = useMemo(
    () => [
      {
        label: 'Главная',
        onClick: () => {
          void navigate('/');
        },
      },
      { label: 'Роли' },
    ],
    [navigate]
  );

  const navigateHome = () => {
    void navigate('/');
  };

  return {
    tableKey,
    initialColumnFilters,
    pagination,
    totalPages,
    totalRecords: roles.total,
    tableSorting,
    breadcrumbs,
    navigateHome,
    handlePaginationChange,
    handleFiltersChange,
    handleSortingChange,
    handleConfigure,
    handleResetFilters,
  };
};
