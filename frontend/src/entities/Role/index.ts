export {
  type RoleCatalogItem,
  type RoleCreate,
  type RoleFilters,
  type RoleScopeBinding,
  type UserPermissions,
  type VisibilityScope,
} from './api';
export { default as RolesTable } from './ui/RolesTable/RolesTable';
export { default as RoleFormFields } from './ui/RoleFormFields/RoleFormFields';
export type { RoleFormValues } from './ui/RoleFormFields/RoleFormFields';
export { useRoles } from './model/useRoles';
export { useRoleById } from './model/useRoleById';
export { useCreateRole, useUpdateRole, useDeleteRole } from './model/useRolesMutations';
export { useRolesQueryStore } from './model/rolesQueryStore';
export { ROLE_TYPES, formatRoleType } from './lib/roleTypeOptions';
export {
  roleScopesToSelectValues,
  selectValuesToRoleScopes,
  formatRoleScopeLabel,
} from './lib/roleScopeOptions';
export {
  CONFIGURABLE_NAVIGATION_KEYS,
  NAVIGATION_LABELS,
  SAMPLE_OPTIONAL_FIELDS,
  SAMPLE_OPTIONAL_FIELD_LABELS,
  SAMPLING_TERMINOLOGY_LABELS,
  defaultRolePermissions,
  getNavigationPermission,
  resolveNavigationKey,
  syncCrudReadFromNavigation,
  type NavigationKey,
  type RolePermissions,
  type SamplingTerminology,
} from './lib/permissionsConfig';
export {
  PermissionsContext,
  resolvePermissionsForScope,
  scopeBindingKey,
  useCan,
  usePermissionsContext,
  useScopeAccess,
} from './lib/permissions';
export type { PermissionsContextValue } from './lib/permissions';
