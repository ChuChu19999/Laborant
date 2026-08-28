import type { CrudPermissions, RolePermissions } from '../permissionsConfig';

function hasOwnKey<T extends object>(obj: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isCrudAction(action: string): action is keyof CrudPermissions {
  return action === 'create' || action === 'read' || action === 'update' || action === 'delete';
}

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
    if (!hasOwnKey(permissions.navigation, action)) {
      return false;
    }
    return Boolean(permissions.navigation[action]);
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
    if (!hasOwnKey(permissions.calculations, action)) {
      return false;
    }
    return Boolean(permissions.calculations[action]);
  }

  if (resource === 'sampling_terminology') {
    return true;
  }

  if (!hasOwnKey(permissions, resource)) {
    return false;
  }

  const section = permissions[resource];
  if (section && typeof section === 'object' && action && 'read' in section) {
    if (hasOwnKey(permissions.navigation, resource) && !permissions.navigation[resource]) {
      return false;
    }
    if (action === 'read') {
      return true;
    }
    if (isCrudAction(action)) {
      return Boolean(section[action]);
    }
  }

  return false;
}
