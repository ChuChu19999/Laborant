import { useDepartmentsByLaboratory } from '@/entities/Department';
import { useLaboratories, useLaboratory } from '@/entities/Laboratory';
import { useNdNorms } from '@/entities/NdNorm';
import { useResearchMethodsForLab } from '@/entities/ResearchMethod';

/** Загружает справочники, методы и список норм НД для панели. */
export const useNdNormsPanelQueries = (labId?: number, deptId?: number) => {
  const { data: laboratories } = useLaboratories(!labId);
  const { data: laboratory } = useLaboratory(labId, !!labId);
  const { data: departments } = useDepartmentsByLaboratory(labId, !!labId);
  const ndNorms = useNdNorms(labId, deptId);
  const { methods, isLoading: isLoadingMethods } = useResearchMethodsForLab(labId, deptId, !!labId);

  return {
    laboratories,
    laboratory,
    departments,
    ndNorms,
    methods,
    isLoadingMethods,
  };
};
