import { useDepartmentsByLaboratory } from '@/entities/Department';
import { useEquipment } from '@/entities/Equipment';
import { useLaboratories, useLaboratory } from '@/entities/Laboratory';

/** Загружает справочники и список приборов для панели. */
export const useEquipmentPanelQueries = (labId?: number, deptId?: number) => {
  const { data: laboratories } = useLaboratories(!labId);
  const { data: laboratory } = useLaboratory(labId, !!labId);
  const { data: departments } = useDepartmentsByLaboratory(labId, !!labId);
  const equipment = useEquipment(labId, deptId);

  return {
    laboratories,
    laboratory,
    departments,
    equipment,
  };
};
