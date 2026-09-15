import type { SampleTypeListParams } from './sampleTypes';

export const sampleTypeKeys = {
  all: ['sample-types'] as const,
  lists: () => [...sampleTypeKeys.all, 'list'] as const,
  list: (params?: SampleTypeListParams) => [...sampleTypeKeys.lists(), params ?? null] as const,
};
