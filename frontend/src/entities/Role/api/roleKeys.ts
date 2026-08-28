export const roleKeys = {
  all: ['roles'] as const,
  lists: () => [...roleKeys.all, 'list'] as const,
  list: (page: number, pageSize: number, filters: unknown, sorting: unknown) =>
    [...roleKeys.lists(), page, pageSize, filters, sorting] as const,
  details: () => [...roleKeys.all, 'detail'] as const,
  detail: (id: number) => [...roleKeys.details(), id] as const,
};
