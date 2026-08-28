export const testObjectKeys = {
  all: ['test-objects'] as const,
  lists: () => [...testObjectKeys.all, 'list'] as const,
  list: (page: number, pageSize: number, filters: unknown, sorting: unknown) =>
    [...testObjectKeys.lists(), page, pageSize, filters, sorting] as const,
  names: (laboratoryId: number | undefined, departmentId: number | undefined) =>
    [...testObjectKeys.all, 'names', laboratoryId, departmentId] as const,
  select: (laboratoryId: number | undefined, departmentId: number | undefined) =>
    [...testObjectKeys.all, 'select', laboratoryId, departmentId] as const,
  sampleTypeOptions: (laboratoryId: number | undefined, departmentId: number | undefined) =>
    [...testObjectKeys.all, 'sample-type-options', laboratoryId, departmentId] as const,
};
