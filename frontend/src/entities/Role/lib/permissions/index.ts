export { checkPermission } from './checkPermission';
export { useCan, usePermissionsContext } from './usePermissions';
export { useScopeAccess } from './useScopeAccess';
export {
  canAccessDepartmentFromScopes,
  canAccessLaboratoryFromScopes,
  mergePermissions,
  resolvePermissionsForScope,
  scopeBindingKey,
} from './roleScopes';
export { PermissionsContext } from './permissionsContext';
export type { PermissionsContextValue } from './permissionsContext';
