export const ROLE_TYPES = [
  { value: 'laborant', label: 'Лаборант' },
  { value: 'engineer', label: 'Инженер' },
] as const;

export type RoleTypeValue = (typeof ROLE_TYPES)[number]['value'];

export const formatRoleType = (roleType: string): string => {
  const match = ROLE_TYPES.find(item => item.value === roleType);
  return match?.label || roleType;
};

export const ROLE_TYPE_OPTIONS = ROLE_TYPES.map(item => ({
  label: item.label,
  value: item.value,
}));
