import type { TestObjectSelectItem } from '../api/testObjects';

export interface SampleTypeOption {
  value: string;
  label: string;
}

export function buildSampleTypeOptionsFromCatalog(
  items: TestObjectSelectItem[]
): SampleTypeOption[] {
  const byTag = new Map<string, string>();

  for (const item of items) {
    if (!byTag.has(item.tag)) {
      byTag.set(item.tag, item.name);
    }
  }

  return Array.from(byTag.entries()).map(([value, label]) => ({ value, label }));
}
