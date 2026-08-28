import { useDepartmentsByLaboratory } from '@/entities/Department';
import { useLaboratories, useLaboratory } from '@/entities/Laboratory';
import { useProtocols } from '@/entities/Protocol';

/** Загружает справочники и список протоколов для панели. */
export const useProtocolsPanelQueries = (labId?: number, deptId?: number) => {
  const { data: laboratories } = useLaboratories(!labId);
  const { data: laboratory } = useLaboratory(labId, !!labId);
  const { data: departments } = useDepartmentsByLaboratory(labId, !!labId);
  const protocols = useProtocols(labId, deptId);

  return {
    laboratories,
    laboratory,
    departments,
    protocols,
  };
};
