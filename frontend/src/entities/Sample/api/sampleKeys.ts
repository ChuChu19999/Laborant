export const sampleKeys = {
  all: ['samples'] as const,
  lists: () => [...sampleKeys.all, 'list'] as const,
  list: (
    laboratoryId: number | undefined,
    departmentId: number | undefined,
    page: number,
    pageSize: number,
    filters: unknown,
    sorting: unknown
  ) =>
    [...sampleKeys.lists(), laboratoryId, departmentId, page, pageSize, filters, sorting] as const,
  details: () => [...sampleKeys.all, 'detail'] as const,
  detail: (id: number) => [...sampleKeys.details(), id] as const,
  types: () => [...sampleKeys.all, 'types'] as const,
  forProtocol: (laboratoryId: number | undefined, departmentId: number | undefined) =>
    [...sampleKeys.all, 'for-protocol', laboratoryId, departmentId] as const,
  forCalculation: (laboratoryId: number | undefined, departmentId: number | undefined) =>
    [...sampleKeys.all, 'for-calculation', laboratoryId, departmentId] as const,
  registrationNumbers: (
    laboratoryId: number | undefined,
    departmentId: number | undefined,
    methodId: number | null | undefined,
    search: string
  ) =>
    [
      ...sampleKeys.all,
      'registration-numbers',
      laboratoryId,
      departmentId,
      methodId,
      search,
    ] as const,
};
