/** Ключи React Query для методик исследований. */
export const researchMethodKeys = {
  all: ['research-methods'] as const,
  lists: () => [...researchMethodKeys.all, 'list'] as const,
  list: (
    laboratoryId: number | undefined,
    departmentId: number | undefined,
    page: number,
    pageSize: number,
    filters: unknown,
    sorting: unknown
  ) =>
    [
      ...researchMethodKeys.lists(),
      laboratoryId,
      departmentId,
      page,
      pageSize,
      filters,
      sorting,
    ] as const,
  details: () => [...researchMethodKeys.all, 'detail'] as const,
  detail: (id: number, includeDeleted?: boolean) =>
    [...researchMethodKeys.details(), id, includeDeleted] as const,
  forLab: (laboratoryId: number | undefined, departmentId: number | undefined) =>
    [...researchMethodKeys.all, 'for-lab', laboratoryId, departmentId] as const,
  forEquipment: (laboratoryId: number | undefined, departmentId: number | undefined) =>
    [...researchMethodKeys.all, 'for-equipment', laboratoryId, departmentId] as const,
  forRefractionTables: (laboratoryId: number | undefined, departmentId: number | undefined) =>
    [...researchMethodKeys.all, 'refraction-tables', laboratoryId, departmentId] as const,
  available: (
    laboratoryId: number | undefined,
    departmentId: number | undefined,
    sampleId: number | undefined
  ) => [...researchMethodKeys.all, 'available', laboratoryId, departmentId, sampleId] as const,
  byIds: (ids: readonly number[]) =>
    [...researchMethodKeys.all, 'by-ids', ...[...ids].sort((a, b) => a - b)] as const,
};

/** Ключи React Query для групп методик. */
export const researchMethodGroupKeys = {
  all: ['research-method-groups'] as const,
  lists: () => [...researchMethodGroupKeys.all, 'list'] as const,
  list: (page: number, pageSize: number, sorting: unknown) =>
    [...researchMethodGroupKeys.lists(), page, pageSize, sorting] as const,
  forLab: () => [...researchMethodGroupKeys.all, 'for-lab'] as const,
  forEquipment: () => [...researchMethodGroupKeys.all, 'for-equipment'] as const,
};
