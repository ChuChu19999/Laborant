import {
  defaultRolePermissions,
  syncCrudReadFromNavigation,
  type RolePermissions,
} from '@/entities/Role';

/** Нормализует permissions привязки роли для редактора. */
export const normalizeScopePermissions = (permissions?: RolePermissions): RolePermissions =>
  syncCrudReadFromNavigation({
    ...(permissions || defaultRolePermissions()),
    navigation: {
      ...(permissions || defaultRolePermissions()).navigation,
      home: true,
    },
  });
