export const branchKeys = {
  all: ['branches'] as const,
  lists: () => [...branchKeys.all, 'list'] as const,
  list: (
    laboratoryId: number | undefined,
    departmentId: number | undefined,
    params?: { search?: string; sort_by?: string; sort_order?: string }
  ) => [...branchKeys.lists(), laboratoryId, departmentId, params ?? null] as const,
};
