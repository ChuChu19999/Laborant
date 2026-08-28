export const ndNormKeys = {
  all: ['nd-norms'] as const,
  lists: () => [...ndNormKeys.all, 'list'] as const,
  list: (
    laboratoryId: number | undefined,
    departmentId: number | undefined,
    page: number,
    pageSize: number,
    filters: unknown,
    sorting: unknown
  ) =>
    [...ndNormKeys.lists(), laboratoryId, departmentId, page, pageSize, filters, sorting] as const,
};
