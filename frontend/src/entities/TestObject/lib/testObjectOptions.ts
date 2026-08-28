/** Опция типа пробы для селекта. */
export interface SampleTypeOption {
  value: string;
  label: string;
}

/** Собирает уникальные опции типов проб из каталога объектов испытаний. */
export function buildSampleTypeOptionsFromCatalog(
  items: { name: string; tag: string }[]
): SampleTypeOption[] {
  const byTag = new Map<string, string>();

  for (const item of items) {
    if (!byTag.has(item.tag)) {
      byTag.set(item.tag, item.name);
    }
  }

  return Array.from(byTag.entries()).map(([value, label]) => ({ value, label }));
}
