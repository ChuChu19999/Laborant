export const samplingLocationKeys = {
  all: ['sampling-locations'] as const,
  lists: () => [...samplingLocationKeys.all, 'list'] as const,
  list: (
    branchId: number | undefined,
    params?: { search?: string; sort_by?: string; sort_order?: string }
  ) => [...samplingLocationKeys.lists(), branchId, params ?? null] as const,
  details: () => [...samplingLocationKeys.all, 'detail'] as const,
  detail: (id: number) => [...samplingLocationKeys.details(), id] as const,
};
