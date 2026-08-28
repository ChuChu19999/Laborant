export const reportKeys = {
  all: ['report-templates'] as const,
  lists: () => [...reportKeys.all, 'list'] as const,
  list: (laboratoryId: number | undefined, departmentId: number | undefined) =>
    [...reportKeys.lists(), laboratoryId, departmentId] as const,
  available: (laboratoryId: number | undefined, departmentId: number | undefined) =>
    [...reportKeys.all, 'available', laboratoryId, departmentId] as const,
  details: () => [...reportKeys.all, 'detail'] as const,
  detail: (id: number | null | undefined) => [...reportKeys.details(), id] as const,
};
