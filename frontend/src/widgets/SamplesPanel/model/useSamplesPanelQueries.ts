import { useDepartmentsByLaboratory } from '@/entities/Department';
import { useLaboratories, useLaboratory } from '@/entities/Laboratory';
import { useSamples } from '@/entities/Sample';

/** Загружает справочники и список проб для панели поступлений. */
export const useSamplesPanelQueries = (labId?: number, deptId?: number) => {
  const { data: laboratories } = useLaboratories(!labId);
  const { data: laboratory } = useLaboratory(labId, !!labId);
  const { data: departments } = useDepartmentsByLaboratory(labId, !!labId);
  const samples = useSamples(labId, deptId);

  return {
    laboratories,
    laboratory,
    departments,
    samples,
    isIlninmLaboratory: laboratory?.name === 'ИЛНиНМ',
  };
};
