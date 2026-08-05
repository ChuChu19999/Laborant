import type { ReactNode } from 'react';
import { useCan } from './usePermissions';
import type { RolePermissions } from '../../config/permissions';

interface CanProps {
  resource: keyof RolePermissions | 'laboratory_management';
  action?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({ resource, action, children, fallback = null }: CanProps) {
  const allowed = useCan(resource, action);
  if (!allowed) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
