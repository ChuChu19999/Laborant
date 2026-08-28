import { useRoles } from '@/entities/Role';

/** Данные списка ролей для панели. */
export const useRolesPanelQueries = () => {
  const roles = useRoles();
  return { roles };
};
