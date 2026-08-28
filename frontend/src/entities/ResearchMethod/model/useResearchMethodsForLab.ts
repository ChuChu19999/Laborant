import { useMemo } from 'react';
import { useAutoRefetchQuery } from '@/shared/model';
import { researchApi, researchMethodGroupKeys, researchMethodKeys } from '../api';

export interface ResearchMethodDisplayItem {
  id: number;
  name: string;
  displayName: string;
  nd_code: string;
  sort_order: number;
}

/** Загружает методики лаборатории с отображаемыми названиями и сортировкой по группам. */
export const useResearchMethodsForLab = (
  laboratoryId?: number,
  departmentId?: number,
  enabled = true
) => {
  const { data: methodsData, isLoading: isLoadingMethods } = useAutoRefetchQuery(
    researchMethodKeys.forLab(laboratoryId, departmentId),
    () =>
      researchApi.getResearchMethods({
        laboratory_id: laboratoryId,
        department_id: departmentId,
      }),
    {
      enabled: enabled && !!laboratoryId,
    }
  );

  const { data: groupsData, isLoading: isLoadingGroups } = useAutoRefetchQuery(
    researchMethodGroupKeys.forLab(),
    () => researchApi.getResearchMethodGroups({}),
    {
      enabled,
    }
  );

  const methods = useMemo<ResearchMethodDisplayItem[]>(() => {
    if (!methodsData?.items || !groupsData?.items) {
      return [];
    }

    const groupsMap = new Map(
      groupsData.items.map(group => [
        group.id,
        { name: group.name, sort_order: group.sort_order || 0 },
      ])
    );

    const methodsWithGroups: (ResearchMethodDisplayItem & {
      groupId: number;
      groupSortOrder: number;
    })[] = [];
    const methodsWithoutGroups: ResearchMethodDisplayItem[] = [];

    methodsData.items
      .filter(method => !method.deleted_at)
      .forEach(method => {
        const firstGroup = method.groups?.[0];
        const groupInfo = firstGroup ? groupsMap.get(firstGroup.id) : null;

        let displayName = method.name;
        if (groupInfo && method.name) {
          displayName = `${groupInfo.name} ${method.name.charAt(0).toLowerCase()}${method.name.slice(1)}`;
        }

        const methodData: ResearchMethodDisplayItem = {
          id: method.id,
          name: method.name,
          displayName: `${displayName} (${method.nd_code})`,
          nd_code: method.nd_code,
          sort_order: method.sort_order || 0,
        };

        if (groupInfo && firstGroup) {
          methodsWithGroups.push({
            ...methodData,
            groupId: firstGroup.id,
            groupSortOrder: groupInfo.sort_order,
          });
        } else {
          methodsWithoutGroups.push(methodData);
        }
      });

    const groupedMethods = new Map<number, typeof methodsWithGroups>();
    methodsWithGroups.forEach(method => {
      if (!groupedMethods.has(method.groupId)) {
        groupedMethods.set(method.groupId, []);
      }
      const groupMethods = groupedMethods.get(method.groupId);
      if (groupMethods) {
        groupMethods.push(method);
      }
    });

    const sortedGroups = Array.from(groupedMethods.entries()).sort((a, b) => {
      const groupA = groupsMap.get(a[0]);
      const groupB = groupsMap.get(b[0]);
      const sortOrderA = groupA?.sort_order || 0;
      const sortOrderB = groupB?.sort_order || 0;
      if (sortOrderA !== sortOrderB) {
        return sortOrderA - sortOrderB;
      }
      const nameA = groupA?.name || '';
      const nameB = groupB?.name || '';
      return nameA.localeCompare(nameB);
    });

    sortedGroups.forEach(([, groupMethods]) => {
      groupMethods.sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return a.displayName.localeCompare(b.displayName);
      });
    });

    methodsWithoutGroups.sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.displayName.localeCompare(b.displayName);
    });

    const result: ResearchMethodDisplayItem[] = [];
    sortedGroups.forEach(([, groupMethods]) => {
      groupMethods.forEach(method => {
        result.push({
          id: method.id,
          name: method.name,
          displayName: method.displayName,
          nd_code: method.nd_code,
          sort_order: method.sort_order,
        });
      });
    });
    result.push(...methodsWithoutGroups);

    return result;
  }, [methodsData, groupsData]);

  return {
    methods,
    isLoading: isLoadingMethods || isLoadingGroups,
  };
};
