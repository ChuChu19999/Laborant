import { useCan, useScopeAccess } from '@/entities/Role';
import { useProtocolsPanelModals } from './useProtocolsPanelModals';
import { useProtocolsPanelQueries } from './useProtocolsPanelQueries';
import { useProtocolsPanelQuerySync } from './useProtocolsPanelQuerySync';
import { useProtocolsPanelTableActions } from './useProtocolsPanelTableActions';

/** Оркестрация экрана протоколов: URL sync, данные, таблица, модалки, права. */
export const useProtocolsPanel = (labId?: number, deptId?: number) => {
  const { canAccessFeature } = useScopeAccess();
  const canCreateProtocol = useCan('protocols', 'create', labId, deptId);
  const canUpdateProtocol = useCan('protocols', 'update', labId, deptId);
  const canDeleteProtocol = useCan('protocols', 'delete', labId, deptId);

  const { searchParams } = useProtocolsPanelQuerySync(labId, deptId);
  const { laboratories, laboratory, departments, protocols } = useProtocolsPanelQueries(
    labId,
    deptId
  );
  const modals = useProtocolsPanelModals(protocols);
  const table = useProtocolsPanelTableActions({
    labId,
    deptId,
    protocols,
    laboratory,
    departments,
    searchParams,
  });

  return {
    labId,
    deptId,
    canAccessFeature,
    canCreateProtocol,
    canUpdateProtocol,
    canDeleteProtocol,
    laboratories,
    laboratory,
    departments,
    protocols,
    modals,
    table,
  };
};
