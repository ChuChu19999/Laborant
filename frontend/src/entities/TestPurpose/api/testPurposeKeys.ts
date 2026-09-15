import type { TestPurposeListParams } from './testPurposes';

export const testPurposeKeys = {
  all: ['test-purposes'] as const,
  lists: () => [...testPurposeKeys.all, 'list'] as const,
  list: (params?: TestPurposeListParams) => [...testPurposeKeys.lists(), params ?? null] as const,
};
