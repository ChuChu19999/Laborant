import { useMemo } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { useAutoRefetchQuery } from '@/shared/model';
import {
  researchApi,
  type ResearchMethod,
  type ResearchMethodGroup,
  researchMethodGroupKeys,
  researchMethodKeys,
} from '../api';
import { useResearchMethodsQueryStore } from './researchMethodsQueryStore';
import type { PaginatedResponse } from '@/shared/lib/http';

/** Загружает список методов исследования с фильтрами и пагинацией. */
export const useResearchMethods = (laboratoryId?: number, departmentId?: number) => {
  const {
    researchMethodsQuery,
    setResearchMethodsPage,
    setResearchMethodsPageSize,
    setResearchMethodsFilters,
    setResearchMethodsSorting,
    setResearchMethodsLaboratoryId,
    setResearchMethodsDepartmentId,
  } = useResearchMethodsQueryStore();

  const effectiveLaboratoryId = laboratoryId ?? researchMethodsQuery.laboratoryId;
  const effectiveDepartmentId =
    laboratoryId !== undefined ? departmentId : (departmentId ?? researchMethodsQuery.departmentId);

  const queryKey = useMemo(
    () =>
      researchMethodKeys.list(
        effectiveLaboratoryId,
        effectiveDepartmentId,
        researchMethodsQuery.page,
        researchMethodsQuery.pageSize,
        researchMethodsQuery.filters,
        researchMethodsQuery.sorting
      ),
    [
      effectiveLaboratoryId,
      effectiveDepartmentId,
      researchMethodsQuery.page,
      researchMethodsQuery.pageSize,
      researchMethodsQuery.filters,
      researchMethodsQuery.sorting,
    ]
  );

  const methodsQueryResult = useAutoRefetchQuery<PaginatedResponse<ResearchMethod>>(
    queryKey,
    () =>
      researchApi.getResearchMethods({
        laboratory_id: effectiveLaboratoryId,
        department_id: effectiveDepartmentId,
        page: researchMethodsQuery.page,
        page_size: researchMethodsQuery.pageSize,
        search: researchMethodsQuery.filters?.search,
        rounding_type: researchMethodsQuery.filters?.rounding_type,
        sort_by: researchMethodsQuery.sorting?.sort_by,
        sort_order: researchMethodsQuery.sorting?.sort_order,
      }),
    {
      enabled: !!effectiveLaboratoryId,
      staleTime: 10 * 1000,
      placeholderData: keepPreviousData,
    }
  );

  const groupsQueryKey = useMemo(
    () =>
      researchMethodGroupKeys.list(
        researchMethodsQuery.page,
        researchMethodsQuery.pageSize,
        researchMethodsQuery.sorting
      ),
    [researchMethodsQuery.page, researchMethodsQuery.pageSize, researchMethodsQuery.sorting]
  );

  const groupsQueryResult = useAutoRefetchQuery<PaginatedResponse<ResearchMethodGroup>>(
    groupsQueryKey,
    () =>
      researchApi.getResearchMethodGroups({
        page: researchMethodsQuery.page,
        page_size: researchMethodsQuery.pageSize,
        sort_by: researchMethodsQuery.sorting?.sort_by,
        sort_order: researchMethodsQuery.sorting?.sort_order,
      }),
    {
      enabled: true,
      staleTime: 10 * 1000,
      placeholderData: keepPreviousData,
    }
  );

  return {
    methods: {
      data: methodsQueryResult.data?.items ?? [],
      total: methodsQueryResult.data?.total ?? 0,
      isLoading: methodsQueryResult.isLoading,
      isFetching: methodsQueryResult.isFetching,
      error: methodsQueryResult.error,
      refetch: methodsQueryResult.refetch,
    },
    groups: {
      data: groupsQueryResult.data?.items ?? [],
      total: groupsQueryResult.data?.total ?? 0,
      isLoading: groupsQueryResult.isLoading,
      isFetching: groupsQueryResult.isFetching,
      error: groupsQueryResult.error,
      refetch: groupsQueryResult.refetch,
    },
    page: researchMethodsQuery.page,
    pageSize: researchMethodsQuery.pageSize,
    filters: researchMethodsQuery.filters,
    sorting: researchMethodsQuery.sorting,
    laboratoryId: effectiveLaboratoryId,
    departmentId: effectiveDepartmentId,
    setPage: setResearchMethodsPage,
    setPageSize: setResearchMethodsPageSize,
    setFilters: setResearchMethodsFilters,
    setSorting: setResearchMethodsSorting,
    setLaboratoryId: setResearchMethodsLaboratoryId,
    setDepartmentId: setResearchMethodsDepartmentId,
    refetch: async () => {
      await Promise.all([methodsQueryResult.refetch(), groupsQueryResult.refetch()]);
    },
  };
};

/** Загружает метод исследования по ID. */
export const useResearchMethod = (
  id: number | null,
  enabled: boolean = true,
  includeDeleted: boolean = false
) => {
  const isQueryEnabled = enabled && id != null;
  const queryResult = useAutoRefetchQuery(
    researchMethodKeys.detail(id ?? 0, includeDeleted),
    () => {
      if (id == null) {
        return Promise.reject(new Error('Research method id is required'));
      }
      return researchApi.getResearchMethod(id, {
        include_deleted: includeDeleted,
      });
    },
    {
      enabled: isQueryEnabled,
    }
  );

  return {
    data: queryResult.data,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    refetch: queryResult.refetch,
  };
};
