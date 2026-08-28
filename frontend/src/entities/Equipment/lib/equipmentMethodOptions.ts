export interface EquipmentMethodOption {
  id: number;
  displayName: string;
}

type MethodLike = {
  id: number;
  name: string;
  nd_code: string;
  sort_order?: number;
  deleted_at?: string;
  groups?: { id: number; name: string }[];
};

type GroupLike = {
  id: number;
  name: string;
  sort_order?: number;
};

/** Собирает отсортированный список методов для выбора в форме прибора. */
export const buildEquipmentMethodOptions = (
  methods: MethodLike[] | undefined,
  groups: GroupLike[] | undefined
): EquipmentMethodOption[] => {
  if (!methods || !groups) {
    return [];
  }

  const groupsMap = new Map(
    groups.map(group => [group.id, { name: group.name, sort_order: group.sort_order || 0 }])
  );

  const methodsWithGroups: {
    id: number;
    name: string;
    displayName: string;
    nd_code: string;
    sort_order: number;
    groupId: number;
  }[] = [];
  const methodsWithoutGroups: {
    id: number;
    name: string;
    displayName: string;
    nd_code: string;
    sort_order: number;
  }[] = [];

  methods
    .filter(method => !method.deleted_at)
    .forEach(method => {
      const firstGroup = method.groups?.[0];
      const groupInfo = firstGroup ? groupsMap.get(firstGroup.id) : null;

      let displayName = method.name;
      if (groupInfo && method.name) {
        displayName = `${groupInfo.name} ${method.name.charAt(0).toLowerCase()}${method.name.slice(1)}`;
      }

      const methodData = {
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

  const result: EquipmentMethodOption[] = [];
  sortedGroups.forEach(([, groupMethods]) => {
    groupMethods.forEach(method => {
      result.push({
        id: method.id,
        displayName: method.displayName,
      });
    });
  });
  result.push(
    ...methodsWithoutGroups.map(method => ({
      id: method.id,
      displayName: method.displayName,
    }))
  );

  return result;
};
