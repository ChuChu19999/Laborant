/** Типы ролей каталога. */
export const ROLE_TYPES = [
  { value: 'laborant', label: 'Лаборант' },
  { value: 'engineer', label: 'Инженер' },
] as const;

export type RoleTypeValue = (typeof ROLE_TYPES)[number]['value'];

/** Фильтры списка ролей. */
export interface RoleFilters {
  search?: string;
  name?: string;
  role_type?: RoleTypeValue;
  [key: string]: unknown;
}

/** Возвращает человекочитаемое название типа роли. */
export const formatRoleType = (roleType: string): string => {
  const match = ROLE_TYPES.find(item => item.value === roleType);
  return match?.label || roleType;
};

/** Опции типа роли для селекта. */
export const ROLE_TYPE_OPTIONS = ROLE_TYPES.map(item => ({
  label: item.label,
  value: item.value,
}));
