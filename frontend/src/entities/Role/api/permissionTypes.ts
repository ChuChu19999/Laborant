import type { RolePermissions } from '../lib/permissionsConfig';

export interface VisibilityScopeEntity {
  id: number;
  name: string;
}

export interface VisibilityScope {
  laboratory_ids: number[];
  department_ids: number[];
  laboratories?: VisibilityScopeEntity[];
  departments?: VisibilityScopeEntity[];
}

export interface RoleScopeBinding {
  laboratory_id: number;
  department_id?: number | null;
  permissions: RolePermissions;
  laboratory_name?: string | null;
  department_name?: string | null;
}

export interface UserPermissions {
  access_granted: boolean;
  is_admin: boolean;
  role_names: string[];
  role_types: string[];
  scopes: RoleScopeBinding[];
  permissions: RolePermissions;
  visibility_scope: VisibilityScope;
}
