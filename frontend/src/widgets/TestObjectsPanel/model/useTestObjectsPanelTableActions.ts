import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildTestObjectsColumnFilters } from '../lib/buildTestObjectsColumnFilters';
import { columnFiltersToTestObjectFilters } from '../lib/columnFiltersToTestObjectFilters';
import type { TestObjectFilters } from '@/entities/TestObject';
import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table';

type TestObjectsListApi = {
  page: number;
  pageSize: number;
  total: number;
  sorting?: { sort_by?: string; sort_order?: 'asc' | 'desc' };
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setFilters: (filters: TestObjectFilters | undefined) => void;
  setSorting: (sorting: { sort_by?: string; sort_order?: 'asc' | 'desc' } | undefined) => void;
};

type UseTestObjectsPanelTableActionsParams = {
  testObjects: TestObjectsListApi;
  searchParams: URLSearchParams;
};

/** Пагинация, фильтры, сортировка и навигация панели объектов испытаний. */
export const useTestObjectsPanelTableActions = ({
  testObjects,
  searchParams,
}: UseTestObjectsPanelTableActionsParams) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [tableKey, setTableKey] = useState(0);

  const initialColumnFilters = useMemo(
    () => buildTestObjectsColumnFilters(searchParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при монтировании / remount таблицы
    [tableKey]
  );

  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: testObjects.page - 1,
      pageSize: testObjects.pageSize,
    }),
    [testObjects.page, testObjects.pageSize]
  );

  const totalPages = Math.max(1, Math.ceil(testObjects.total / testObjects.pageSize));

  const tableSorting: SortingState = testObjects.sorting?.sort_by
    ? [
        {
          id: testObjects.sorting.sort_by,
          desc: testObjects.sorting.sort_order === 'desc',
        },
      ]
    : [];

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
      testObjects.setFilters(columnFiltersToTestObjectFilters(filters));
      testObjects.setPage(1);
    },
    [testObjects]
  );

  const handleSortingChange = useCallback(
    (sortingState: SortingState) => {
      const sort = sortingState[0];
      if (sort) {
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

  const handleResetFilters = () => {
    testObjects.setFilters(undefined);
    testObjects.setSorting(undefined);
    testObjects.setPage(1);
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
      { label: 'Объекты испытаний' },
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
    totalRecords: testObjects.total,
    tableSorting,
    breadcrumbs,
    navigateHome,
    handlePaginationChange,
    handleFiltersChange,
    handleSortingChange,
    handleResetFilters,
  };
};
