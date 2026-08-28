export const userRoleKeys = {
  all: ['user-roles'] as const,
  me: () => [...userRoleKeys.all, 'me'] as const,
};
