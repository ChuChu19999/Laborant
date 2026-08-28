import { useTestObjectsPanelModals } from './useTestObjectsPanelModals';
import { useTestObjectsPanelQueries } from './useTestObjectsPanelQueries';
import { useTestObjectsPanelQuerySync } from './useTestObjectsPanelQuerySync';
import { useTestObjectsPanelTableActions } from './useTestObjectsPanelTableActions';

/** Оркестрация экрана объектов испытаний: URL sync, данные, таблица, модалки. */
export const useTestObjectsPanel = () => {
  const { searchParams } = useTestObjectsPanelQuerySync();
  const { testObjects } = useTestObjectsPanelQueries();
  const modals = useTestObjectsPanelModals(testObjects);
  const table = useTestObjectsPanelTableActions({ testObjects, searchParams });

  return {
    testObjects,
    modals,
    table,
  };
};
