import { useAutoRefetchQuery } from '@/shared/model';
import { type RoleCatalogItem, roleKeys, rolesApi } from '../api';

/** Загружает роль по идентификатору. */
export const useRoleById = (id: number | undefined, enabled = true) => {
  const isQueryEnabled = enabled && id != null && !Number.isNaN(id);
  return useAutoRefetchQuery<RoleCatalogItem>(
    roleKeys.detail(id ?? 0),
    () => {
      if (id == null || Number.isNaN(id)) {
        return Promise.reject(new Error('Role id is required'));
      }
      return rolesApi.getRoleById(id);
    },
    {
      enabled: isQueryEnabled,
    }
  );
};
