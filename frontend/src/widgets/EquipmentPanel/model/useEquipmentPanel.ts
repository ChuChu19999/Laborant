import { useCan, useScopeAccess } from '@/entities/Role';
import { useEquipmentPanelModals } from './useEquipmentPanelModals';
import { useEquipmentPanelQueries } from './useEquipmentPanelQueries';
import { useEquipmentPanelQuerySync } from './useEquipmentPanelQuerySync';
import { useEquipmentPanelTableActions } from './useEquipmentPanelTableActions';

/** Оркестрация экрана приборов: URL sync, данные, таблица, модалки, права. */
export const useEquipmentPanel = (labId?: number, deptId?: number) => {
  const { canAccessFeature } = useScopeAccess();
  const canCreateEquipment = useCan('equipment', 'create', labId, deptId);
  const canUpdateEquipment = useCan('equipment', 'update', labId, deptId);
  const canDeleteEquipment = useCan('equipment', 'delete', labId, deptId);

  const { searchParams } = useEquipmentPanelQuerySync(labId, deptId);
  const { laboratories, laboratory, departments, equipment } = useEquipmentPanelQueries(
    labId,
    deptId
  );
  const modals = useEquipmentPanelModals(equipment);
  const table = useEquipmentPanelTableActions({
    labId,
    deptId,
    equipment,
    laboratory,
    departments,
    searchParams,
  });

  return {
    labId,
    deptId,
    canAccessFeature,
    canCreateEquipment,
    canUpdateEquipment,
    canDeleteEquipment,
    laboratories,
    laboratory,
    departments,
    equipment,
    modals,
    table,
  };
};
