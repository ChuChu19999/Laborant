import type { TestObjectFilters } from '@/entities/TestObject';
import type { ColumnFiltersState } from '@tanstack/react-table';

/** Преобразует фильтры колонок TanStack Table в параметры API списка объектов испытаний. */
export function columnFiltersToTestObjectFilters(
  columnFilters: ColumnFiltersState
): TestObjectFilters {
  const nameFilter = columnFilters.find(filter => filter.id === 'name');
  const tagFilter = columnFilters.find(filter => filter.id === 'tag');
  const nameValue =
    nameFilter && typeof nameFilter.value === 'string' ? nameFilter.value.trim() : '';
  const tagValue = tagFilter && typeof tagFilter.value === 'string' ? tagFilter.value.trim() : '';
  const searchValue = [nameValue, tagValue].filter(Boolean).join(' ').trim();

  return {
    search: searchValue || undefined,
    name: nameValue || undefined,
    tag: tagValue || undefined,
  };
}
