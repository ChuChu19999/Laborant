import { useMemo } from 'react';
import {
  researchApi,
  type PaginatedResponse,
  type ResearchMethod,
  type ResearchMethodGroup,
} from '../../api/research';
import { useAutoRefetchQuery } from '../lib/useQuery';
import { useQueryStore } from '../stores';

/**
 * Хук для работы с методами исследования
 * Использует React Query
 */
export const useResearchMethods = (laboratoryId?: number, departmentId?: number) => {
  const {
    researchMethodsQuery,
    setResearchMethodsPage,
    setResearchMethodsPageSize,
    setResearchMethodsFilters,
    setResearchMethodsSorting,
    setResearchMethodsLaboratoryId,
    setResearchMethodsDepartmentId,
  } = useQueryStore();

  const effectiveLaboratoryId = laboratoryId ?? researchMethodsQuery.laboratoryId;
  const effectiveDepartmentId = departmentId ?? researchMethodsQuery.departmentId;

  const queryKey = useMemo(
    () => [
      'research-methods',
      'list',
      effectiveLaboratoryId,
      effectiveDepartmentId,
      researchMethodsQuery.page,
      researchMethodsQuery.pageSize,
      researchMethodsQuery.filters,
      researchMethodsQuery.sorting,
    ],
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
    }
  );

  const groupsQueryKey = useMemo(
    () => [
      'research-method-groups',
      'list',
      researchMethodsQuery.page,
      researchMethodsQuery.pageSize,
      researchMethodsQuery.sorting,
    ],
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
    refetch: () => {
      methodsQueryResult.refetch();
      groupsQueryResult.refetch();
    },
  };
};

/**
 * Хук для получения метода исследования по ID
 */
export const useResearchMethod = (id: number | null, enabled: boolean = true) => {
  const queryResult = useAutoRefetchQuery(
    ['research-methods', id],
    () => researchApi.getResearchMethod(id!),
    {
      enabled: enabled && !!id,
    }
  );

  return {
    data: queryResult.data,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    refetch: queryResult.refetch,
  };
};
