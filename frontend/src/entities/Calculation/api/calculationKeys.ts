export const calculationKeys = {
  all: ['calculations'] as const,
  lists: () => [...calculationKeys.all, 'list'] as const,
  list: (filters?: { sample_id?: number } | null) =>
    [...calculationKeys.lists(), filters ?? null] as const,
  bySample: (sampleId: number) => [...calculationKeys.list({ sample_id: sampleId })] as const,
  details: () => [...calculationKeys.all, 'detail'] as const,
  detail: (id: number) => [...calculationKeys.details(), id] as const,
  methodologyChoice: (id: number) => [...calculationKeys.all, 'methodology-choice', id] as const,
};
