import { useRolesPanelModals } from './useRolesPanelModals';
import { useRolesPanelQueries } from './useRolesPanelQueries';
import { useRolesPanelQuerySync } from './useRolesPanelQuerySync';
import { useRolesPanelTableActions } from './useRolesPanelTableActions';

/** Оркестрация экрана ролей: URL sync, данные, таблица, модалки. */
export const useRolesPanel = () => {
  const { searchParams } = useRolesPanelQuerySync();
  const { roles } = useRolesPanelQueries();
  const modals = useRolesPanelModals(roles);
  const table = useRolesPanelTableActions({ roles, searchParams });

  return {
    roles,
    modals,
    table,
  };
};
