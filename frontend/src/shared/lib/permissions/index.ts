export { Can } from './Can';
export { useCan, usePermissionsContext } from './usePermissions';
export { useScopeAccess } from './useScopeAccess';
export {
  canAccessDepartmentFromScopes,
  canAccessLaboratoryFromScopes,
  resolvePermissionsForScope,
  scopeBindingKey,
} from './roleScopes';
export {
  isLaboratoryCardAccessible,
  isScopeUnrestricted,
  isVisibleInScope,
} from './visibilityScope';
export type { PermissionsOutletContext } from './usePermissions';
