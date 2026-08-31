import { Navigate } from 'react-router-dom';
import {
  getNavigationPermission,
  resolveNavigationKey,
  type UserPermissions,
} from '@/entities/Role';

interface ProtectedRouteProps {
  permissionsData: UserPermissions;
  path: string;
  children: React.ReactElement;
}

const FORBIDDEN_PATH = '/403';

const ProtectedRoute = ({ permissionsData, path, children }: ProtectedRouteProps) => {
  if (!permissionsData.access_granted) {
    return <Navigate to={FORBIDDEN_PATH} replace />;
  }

  if (permissionsData.is_admin) {
    return children;
  }

  const navKey = resolveNavigationKey(path);

  if (navKey === 'help' || navKey === 'home') {
    return children;
  }

  if (navKey === 'roles' || navKey === 'test_objects' || navKey === 'monitoring') {
    return <Navigate to={FORBIDDEN_PATH} replace />;
  }

  if (navKey === 'admin') {
    if (!permissionsData.permissions.laboratory_management.access) {
      return <Navigate to={FORBIDDEN_PATH} replace />;
    }
    return children;
  }

  if (navKey) {
    const allowed = getNavigationPermission(permissionsData.permissions.navigation, navKey);
    if (allowed === undefined) {
      return children;
    }
    if (!allowed) {
      return <Navigate to={FORBIDDEN_PATH} replace />;
    }
    return children;
  }

  return children;
};

export default ProtectedRoute;
