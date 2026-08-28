export const laboratoryKeys = {
  all: ['laboratories'] as const,
  lists: () => [...laboratoryKeys.all, 'list'] as const,
  list: () => [...laboratoryKeys.lists()] as const,
  withDepartments: () => [...laboratoryKeys.all, 'with-departments'] as const,
  details: () => [...laboratoryKeys.all, 'detail'] as const,
  detail: (id: number | undefined) => [...laboratoryKeys.details(), id] as const,
};
