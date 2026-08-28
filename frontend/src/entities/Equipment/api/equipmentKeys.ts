export const equipmentKeys = {
  all: ['equipment'] as const,
  lists: () => [...equipmentKeys.all, 'list'] as const,
  list: (
    laboratoryId: number | undefined,
    departmentId: number | undefined,
    page: number,
    pageSize: number,
    filters: unknown,
    sorting: unknown
  ) =>
    [
      ...equipmentKeys.lists(),
      laboratoryId,
      departmentId,
      page,
      pageSize,
      filters,
      sorting,
    ] as const,
  details: () => [...equipmentKeys.all, 'detail'] as const,
  detail: (id: number) => [...equipmentKeys.details(), id] as const,
  forScope: (laboratoryId: number | undefined, departmentId: number | undefined) =>
    [...equipmentKeys.all, 'for-scope', laboratoryId, departmentId] as const,
  forCalculation: (laboratoryId: number | undefined, departmentId: number | undefined) =>
    [...equipmentKeys.all, 'for-calculation', laboratoryId, departmentId] as const,
};
