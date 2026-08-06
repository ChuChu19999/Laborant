import type { CrudPermissions, RolePermissions } from '../../config/permissions';

/** Проверка одного права в уже выбранной матрице permissions. */
export function checkPermission(
  permissions: RolePermissions,
  resource: keyof RolePermissions | 'laboratory_management',
  action?: string
): boolean {
  if (resource === 'laboratory_management') {
    return Boolean(permissions.laboratory_management.access);
  }

  if (resource === 'navigation' && action) {
    return Boolean(permissions.navigation[action as keyof typeof permissions.navigation]);
  }

  if (resource === 'samples' && action) {
    if (action === 'update' || action === 'delete') {
      return Boolean(permissions.samples[action]);
    }
    if (action === 'visible_fields') {
      return true;
    }
    return permissions.samples.visible_fields.includes(action);
  }

  if (resource === 'calculations' && action) {
    return Boolean(permissions.calculations[action as keyof typeof permissions.calculations]);
  }

  if (resource === 'sampling_terminology') {
    return true;
  }

  const section = permissions[resource as keyof RolePermissions];
  if (section && typeof section === 'object' && action && 'read' in section) {
    const navKey = resource as keyof typeof permissions.navigation;
    const hasNav = navKey in permissions.navigation && Boolean(permissions.navigation[navKey]);
    if (!hasNav) {
      return false;
    }
    if (action === 'read') {
      return true;
    }
    return Boolean((section as CrudPermissions)[action as keyof CrudPermissions]);
  }

  return false;
}
