import { useTestObjects } from '@/entities/TestObject';

/** Данные списка объектов испытаний для панели. */
export const useTestObjectsPanelQueries = () => {
  const testObjects = useTestObjects();
  return { testObjects };
};
