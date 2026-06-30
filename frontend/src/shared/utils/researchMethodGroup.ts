export interface GroupMethodSortable {
  id: number;
  name: string;
  sort_order?: number;
}

/** Сортировка методов внутри группы: sort_order, затем имя. */
export function sortGroupMethods<T extends GroupMethodSortable>(methods: T[]): T[] {
  return [...methods].sort((a, b) => {
    const orderA = a.sort_order ?? 0;
    const orderB = b.sort_order ?? 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.name.localeCompare(b.name, 'ru');
  });
}

/** Первый метод группы в порядке отображения. */
export function getFirstGroupMethodId(methods: GroupMethodSortable[]): number | null {
  const sorted = sortGroupMethods(methods);
  return sorted[0]?.id ?? null;
}

export function enrichGroupMethodsWithSortOrder(
  groupMethodRefs: Array<{ id: number; name: string }>,
  allMethods: Array<{ id: number; sort_order?: number }>
): GroupMethodSortable[] {
  return groupMethodRefs.map(ref => {
    const full = allMethods.find(m => m.id === ref.id);
    return {
      id: ref.id,
      name: ref.name,
      sort_order: full?.sort_order,
    };
  });
}
