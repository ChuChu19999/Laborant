import { useMemo, useState } from 'react';
import {
  resolvePermissionsForScope,
  SAMPLING_TERMINOLOGY_LABELS,
  useCan,
  usePermissionsContext,
  useScopeAccess,
} from '@/entities/Role';
import { useSamplingLocationsPanelModals } from './useSamplingLocationsPanelModals';
import { useSamplingLocationsPanelNavigation } from './useSamplingLocationsPanelNavigation';
import { useSamplingLocationsPanelQueries } from './useSamplingLocationsPanelQueries';
import { useSamplingLocationsPanelSelection } from './useSamplingLocationsPanelSelection';
import type { Branch } from '@/entities/Branch';
import type { Department } from '@/entities/Department';
import type { SamplingLocation } from '@/entities/SamplingLocation';
import type { WellMode } from '@/entities/WellMode';

/** Оркестрация экрана мест отбора проб: scope, данные, selection, навигация, модалки. */
export const useSamplingLocationsPanel = (
  labId: number | undefined,
  deptId: number | undefined
) => {
  const { permissionsData } = usePermissionsContext();
  const { canAccessFeature } = useScopeAccess();
  const canCreate = useCan('sampling_locations', 'create', labId, deptId);
  const canUpdate = useCan('sampling_locations', 'update', labId, deptId);
  const canDelete = useCan('sampling_locations', 'delete', labId, deptId);

  const scopedPermissions =
    resolvePermissionsForScope(permissionsData.scopes, labId, deptId) ||
    permissionsData.permissions;
  const terminologyLabel =
    SAMPLING_TERMINOLOGY_LABELS[scopedPermissions.sampling_terminology || 'well_mode'];

  // selectedBranch живет здесь, чтобы queries могли зависеть от id до фильтрации списка
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const {
    laboratories,
    laboratory,
    departments,
    branches,
    samplingLocationsData,
    isSamplingLocationsPlaceholder,
    isSamplingLocationsLoading,
    wellModesData,
    isWellModesPlaceholder,
    isWellModesLoading,
  } = useSamplingLocationsPanelQueries(labId, deptId, selectedBranch?.id);

  const departmentsList = useMemo(
    () => (departments ?? []).filter((department: Department) => !department.deleted_at),
    [departments]
  );

  const branchesList = useMemo(
    () => branches?.items?.filter(branch => !branch.deleted_at) ?? [],
    [branches?.items]
  );

  const { reselectAfterBranchRemoved } = useSamplingLocationsPanelSelection(
    labId,
    deptId,
    branchesList,
    selectedBranch,
    setSelectedBranch
  );

  const samplingLocations = useMemo(
    () =>
      samplingLocationsData?.items?.filter((location: SamplingLocation) => !location.deleted_at) ??
      [],
    [samplingLocationsData?.items]
  );

  const wellModes = useMemo(
    () => wellModesData?.items?.filter((mode: WellMode) => !mode.deleted_at) ?? [],
    [wellModesData?.items]
  );

  const department = useMemo(() => {
    if (!deptId || !departments) return null;
    return departments.find(dept => dept.id === deptId) || null;
  }, [deptId, departments]);

  const navigation = useSamplingLocationsPanelNavigation({
    labId,
    deptId,
    laboratory,
    department,
    selectedBranch,
  });

  const modals = useSamplingLocationsPanelModals({
    onAfterDeleteBranch: reselectAfterBranchRemoved,
  });

  const laboratoriesList = laboratories?.items ?? [];

  const isInitialLoading =
    (!labId && !laboratories) ||
    (labId && !laboratory && !departments) ||
    (labId && (deptId || departmentsList.length === 0) && !branches && branchesList.length === 0);

  const pageTitle =
    (department && department.name) || (laboratory && laboratory.name) || 'Места отбора проб';

  return {
    labId,
    deptId,
    canCreate,
    canUpdate,
    canDelete,
    canAccessFeature,
    terminologyLabel,
    selectedBranch,
    setSelectedBranch,
    laboratoriesList,
    laboratory,
    departmentsList,
    branchesList,
    samplingLocations,
    wellModes,
    isSamplingLocationsLoading,
    isSamplingLocationsPlaceholder,
    isWellModesLoading,
    isWellModesPlaceholder,
    isInitialLoading,
    pageTitle,
    navigation,
    modals,
  };
};
