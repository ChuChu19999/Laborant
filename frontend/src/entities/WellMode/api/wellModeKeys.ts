export const wellModeKeys = {
  all: ['well-modes'] as const,
  lists: () => [...wellModeKeys.all, 'list'] as const,
  list: (
    branchId: number | undefined,
    params?: { search?: string; sort_by?: string; sort_order?: string }
  ) => [...wellModeKeys.lists(), branchId, params ?? null] as const,
};
