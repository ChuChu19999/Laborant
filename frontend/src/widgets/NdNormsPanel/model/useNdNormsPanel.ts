import { useCan, useScopeAccess } from '@/entities/Role';
import { useNdNormsPanelModals } from './useNdNormsPanelModals';
import { useNdNormsPanelQueries } from './useNdNormsPanelQueries';
import { useNdNormsPanelQuerySync } from './useNdNormsPanelQuerySync';
import { useNdNormsPanelTableActions } from './useNdNormsPanelTableActions';

/** Оркестрация экрана норм НД: URL sync, данные, таблица, модалки, права. */
export const useNdNormsPanel = (labId?: number, deptId?: number) => {
  const { canAccessFeature } = useScopeAccess();
  const canCreateNdNorm = useCan('nd_norms', 'create', labId, deptId);
  const canUpdateNdNorm = useCan('nd_norms', 'update', labId, deptId);
  const canDeleteNdNorm = useCan('nd_norms', 'delete', labId, deptId);

  const { searchParams } = useNdNormsPanelQuerySync(labId, deptId);
  const { laboratories, laboratory, departments, ndNorms, methods, isLoadingMethods } =
    useNdNormsPanelQueries(labId, deptId);
  const modals = useNdNormsPanelModals(ndNorms);
  const table = useNdNormsPanelTableActions({
    labId,
    deptId,
    ndNorms,
    laboratory,
    departments,
    searchParams,
  });

  return {
    labId,
    deptId,
    canAccessFeature,
    canCreateNdNorm,
    canUpdateNdNorm,
    canDeleteNdNorm,
    laboratories,
    laboratory,
    departments,
    ndNorms,
    methods,
    isLoadingMethods,
    modals,
    table,
  };
};
