import { useQuery } from '@tanstack/react-query';
import { userRoleApi, userRoleKeys } from '../../api/userRole';
import { defaultRolePermissions } from '../../config/permissions';
import type { UserPermissions } from '../../api/userRole';

interface UseCurrentPermissionsProps {
  isKeycloakReady: boolean;
}

interface UseCurrentPermissionsResult {
  isLoading: boolean;
  error: Error | null;
  data: UserPermissions;
  accessGranted: boolean;
  isAdmin: boolean;
  refetch: () => void;
}

const deniedDefaults = (): UserPermissions => ({
  access_granted: false,
  is_admin: false,
  role_names: [],
  role_types: [],
  scopes: [],
  permissions: defaultRolePermissions(),
  visibility_scope: {
    laboratory_ids: [],
    department_ids: [],
  },
});

export const useCurrentPermissions = ({
  isKeycloakReady,
}: UseCurrentPermissionsProps): UseCurrentPermissionsResult => {
  const query = useQuery({
    queryKey: userRoleKeys.me(),
    queryFn: () => userRoleApi.getMyPermissions(),
    enabled: isKeycloakReady,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const data = query.data ?? deniedDefaults();

  return {
    isLoading: !isKeycloakReady || query.isLoading,
    error: query.error instanceof Error ? query.error : null,
    data,
    accessGranted: data.access_granted,
    isAdmin: data.is_admin,
    refetch: () => {
      void query.refetch();
    },
  };
};
