import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAutoRefetchQuery } from '@/shared/model';
import {
  researchApi,
  researchMethodGroupKeys,
  researchMethodKeys,
  type ResearchMethod,
} from '../api';
import type { PaginatedResponse } from '@/shared/lib/http';

/** Загружает методики без store списка — для выбора в форме группы. */
export const useResearchMethodsForGroupCreate = (
  laboratoryId: number | undefined,
  departmentId: number | undefined,
  enabled = true
) => {
  return useAutoRefetchQuery<PaginatedResponse<ResearchMethod>>(
    researchMethodKeys.list(laboratoryId, departmentId, 1, 100, {}, null),
    () => {
      if (laboratoryId == null) {
        return Promise.reject(new Error('Laboratory id is required'));
      }
      return researchApi.getResearchMethods({
        laboratory_id: laboratoryId,
        department_id: departmentId,
        page_size: 100,
      });
    },
    {
      enabled: enabled && laboratoryId != null,
      refetchInterval: false,
      refetchOnWindowFocus: false,
    }
  );
};

/** Проверить наличие методов у лаборатории (total через page_size=1). */
export const useLaboratoryHasResearchMethodsQuery = (
  laboratoryId: number | undefined,
  enabled: boolean
) => {
  return useAutoRefetchQuery<PaginatedResponse<ResearchMethod>>(
    researchMethodKeys.list(laboratoryId, undefined, 1, 1, undefined, undefined),
    () => {
      if (laboratoryId == null) {
        return Promise.reject(new Error('Laboratory id is required'));
      }
      return researchApi.getResearchMethods({
        laboratory_id: laboratoryId,
        page: 1,
        page_size: 1,
      });
    },
    {
      enabled: enabled && laboratoryId != null,
      refetchInterval: false,
      refetchOnWindowFocus: false,
    }
  );
};

/** Императивная загрузка одной методики через React Query cache. */
export const useResearchMethodQueries = () => {
  const queryClient = useQueryClient();

  const fetchResearchMethod = useCallback(
    (id: number, includeDeleted = false) =>
      queryClient.fetchQuery({
        queryKey: researchMethodKeys.detail(id, includeDeleted),
        queryFn: () =>
          researchApi.getResearchMethod(id, {
            include_deleted: includeDeleted,
          }),
      }),
    [queryClient]
  );

  return {
    fetchResearchMethod,
  };
};

/** Загружает методики и группы для привязки к оборудованию. */
export const useResearchMethodsForEquipment = (
  laboratoryId: number | undefined,
  departmentId: number | undefined,
  enabled = true
) => {
  const methodsQuery = useAutoRefetchQuery(
    researchMethodKeys.forEquipment(laboratoryId, departmentId),
    () =>
      researchApi.getResearchMethods({
        laboratory_id: laboratoryId,
        department_id: departmentId,
      }),
    { enabled: enabled && !!laboratoryId }
  );

  const groupsQuery = useAutoRefetchQuery(
    researchMethodGroupKeys.forEquipment(),
    () => researchApi.getResearchMethodGroups({}),
    { enabled }
  );

  return {
    methodsData: methodsQuery.data,
    groupsData: groupsQuery.data,
    isLoadingMethods: methodsQuery.isLoading,
    isLoadingGroups: groupsQuery.isLoading,
  };
};

/** Загружает методики для справочника градуировочного графика. */
export const useResearchMethodsForRefractionTables = (
  laboratoryId: number | undefined,
  departmentId: number | undefined,
  enabled = true
) => {
  return useAutoRefetchQuery(
    researchMethodKeys.forRefractionTables(laboratoryId, departmentId),
    () =>
      researchApi.getResearchMethods({
        laboratory_id: laboratoryId,
        department_id: departmentId,
      }),
    { enabled: enabled && !!laboratoryId }
  );
};
