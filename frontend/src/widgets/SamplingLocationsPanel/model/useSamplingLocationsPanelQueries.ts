import { useBranches } from '@/entities/Branch';
import { useDepartmentsByLaboratory } from '@/entities/Department';
import { useLaboratories, useLaboratory } from '@/entities/Laboratory';
import { useSamplingLocationsByBranch } from '@/entities/SamplingLocation';
import { useWellModesByBranch } from '@/entities/WellMode';

/** Загружает данные панелей мест отбора, филиалов и режимов скважин. */
export const useSamplingLocationsPanelQueries = (
  labId: number | undefined,
  deptId: number | undefined,
  selectedBranchId: number | undefined
) => {
  const laboratoriesQuery = useLaboratories(!labId);
  const laboratoryQuery = useLaboratory(labId, !!labId);
  const departmentsQuery = useDepartmentsByLaboratory(labId, !!labId);
  const branchesQuery = useBranches(labId, deptId, !!labId);
  const samplingLocationsQuery = useSamplingLocationsByBranch(selectedBranchId, !!selectedBranchId);
  const wellModesQuery = useWellModesByBranch(selectedBranchId, !!selectedBranchId);

  return {
    laboratories: laboratoriesQuery.data,
    laboratory: laboratoryQuery.data,
    departments: departmentsQuery.data,
    branches: branchesQuery.data,
    samplingLocationsData: samplingLocationsQuery.data,
    isSamplingLocationsPlaceholder: samplingLocationsQuery.isPlaceholderData,
    isSamplingLocationsLoading: samplingLocationsQuery.isLoading,
    wellModesData: wellModesQuery.data,
    isWellModesPlaceholder: wellModesQuery.isPlaceholderData,
    isWellModesLoading: wellModesQuery.isLoading,
  };
};
