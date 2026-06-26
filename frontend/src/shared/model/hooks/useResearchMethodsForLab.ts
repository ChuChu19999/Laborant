import { useMemo } from 'react';
import { researchApi } from '../../api/research';
import { useAutoRefetchQuery } from '../lib/useQuery';

export interface ResearchMethodDisplayItem {
  id: number;
  name: string;
  displayName: string;
  nd_code: string;
  sort_order: number;
}

export const useResearchMethodsForLab = (
  laboratoryId?: number,
  departmentId?: number,
  enabled = true
) => {
  const { data: methodsData, isLoading: isLoadingMethods } = useAutoRefetchQuery(
    ['research-methods', 'for-lab', laboratoryId, departmentId],
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
    ['research-method-groups', 'for-lab'],
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

    const methodsWithGroups: Array<
      ResearchMethodDisplayItem & { groupId: number; groupSortOrder: number }
    > = [];
    const methodsWithoutGroups: ResearchMethodDisplayItem[] = [];

    methodsData.items
      .filter(method => !method.deleted_at)
      .forEach(method => {
        const groupInfo =
          method.groups && method.groups.length > 0 ? groupsMap.get(method.groups[0].id) : null;

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

        if (groupInfo && method.groups && method.groups.length > 0) {
          methodsWithGroups.push({
            ...methodData,
            groupId: method.groups[0].id,
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
      groupedMethods.get(method.groupId)!.push(method);
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
