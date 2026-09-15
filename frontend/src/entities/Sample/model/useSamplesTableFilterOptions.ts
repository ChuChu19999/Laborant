import { useMemo } from 'react';
import { useSampleTypesList } from '@/entities/SampleType/@x/Sample';
import { useTestObjectNames } from '@/entities/TestObject/@x/Sample';

/** Опции фильтров таблицы проб (типы и объекты испытаний). */
export const useSamplesTableFilterOptions = (laboratoryId?: number, departmentId?: number) => {
  const { data: sampleTypesData } = useSampleTypesList(laboratoryId, departmentId, !!laboratoryId);
  const sampleTypes = useMemo(
    () => (sampleTypesData?.items || []).map(sampleType => sampleType.name),
    [sampleTypesData?.items]
  );
  const { data: testObjects = [] } = useTestObjectNames(laboratoryId, departmentId, !!laboratoryId);

  return { sampleTypes, testObjects };
};
