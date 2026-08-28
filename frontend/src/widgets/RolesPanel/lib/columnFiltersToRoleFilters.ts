import { ROLE_TYPES, type RoleFilters } from '@/entities/Role';
import type { ColumnFiltersState } from '@tanstack/react-table';

/** Преобразует фильтры колонок TanStack Table в параметры API списка ролей. */
export function columnFiltersToRoleFilters(columnFilters: ColumnFiltersState): RoleFilters {
  const nameFilter = columnFilters.find(filter => filter.id === 'name');
  const roleTypeFilter = columnFilters.find(filter => filter.id === 'role_type');
  const nameValue =
    nameFilter && typeof nameFilter.value === 'string' ? nameFilter.value.trim() : '';
  const roleTypeRaw =
    roleTypeFilter && typeof roleTypeFilter.value === 'string' ? roleTypeFilter.value.trim() : '';
  const roleTypeValue = ROLE_TYPES.find(item => item.value === roleTypeRaw)?.value;

  return {
    search: nameValue || undefined,
    name: nameValue || undefined,
    role_type: roleTypeValue,
  };
}
