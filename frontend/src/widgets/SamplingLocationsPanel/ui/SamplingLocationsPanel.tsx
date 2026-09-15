import { useParams } from 'react-router-dom';
import { Layout } from '@/shared/ui/Layout';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import { useSamplingLocationsPanel } from '../model/useSamplingLocationsPanel';
import SamplingLocationsDepartmentsView from './SamplingLocationsDepartmentsView';
import SamplingLocationsLaboratoriesView from './SamplingLocationsLaboratoriesView';
import SamplingLocationsWorkspaceView from './SamplingLocationsWorkspaceView';
import './SamplingLocationsPanel.css';

const SamplingLocationsPanel = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;

  const panel = useSamplingLocationsPanel(labId, deptId);
  const { navigation, modals } = panel;

  if (panel.isInitialLoading) {
    return (
      <Layout title="Места отбора проб">
        <NavigationBar
          breadcrumbs={navigation.breadcrumbs}
          onBack={navigation.handleBack}
          showBack={!!labId}
        />
        <LoadingCard loading />
      </Layout>
    );
  }

  if (!labId) {
    return (
      <SamplingLocationsLaboratoriesView
        breadcrumbs={navigation.breadcrumbs}
        laboratories={panel.laboratoriesList}
        onLaboratoryClick={navigation.handleLaboratoryClick}
        onBack={navigation.navigateHome}
        canAccessLaboratory={laboratoryIdArg =>
          panel.canAccessFeature('sampling_locations', 'read', laboratoryIdArg)
        }
      />
    );
  }

  if (!deptId && panel.departmentsList.length > 0) {
    return (
      <SamplingLocationsDepartmentsView
        title={panel.laboratory?.name || 'Места отбора проб'}
        breadcrumbs={navigation.breadcrumbs}
        departments={panel.departmentsList}
        laboratoryId={labId}
        onDepartmentClick={navigation.handleDepartmentClick}
        onBack={navigation.handleBack}
        canAccessDepartment={(laboratoryIdArg, departmentIdArg) =>
          panel.canAccessFeature('sampling_locations', 'read', laboratoryIdArg, departmentIdArg)
        }
      />
    );
  }

  return (
    <SamplingLocationsWorkspaceView
      title={panel.pageTitle}
      breadcrumbs={navigation.breadcrumbs}
      onBack={navigation.handleBack}
      labId={labId}
      deptId={deptId}
      terminologyLabel={panel.terminologyLabel}
      canCreate={panel.canCreate}
      canUpdate={panel.canUpdate}
      canDelete={panel.canDelete}
      canShowPhone={panel.canShowPhone}
      selectedBranch={panel.selectedBranch}
      onSelectBranch={panel.setSelectedBranch}
      branches={panel.branchesList}
      samplingLocations={panel.samplingLocations}
      wellModes={panel.wellModes}
      isSamplingLocationsLoading={panel.isSamplingLocationsLoading}
      isSamplingLocationsPlaceholder={panel.isSamplingLocationsPlaceholder}
      isWellModesLoading={panel.isWellModesLoading}
      isWellModesPlaceholder={panel.isWellModesPlaceholder}
      modals={modals}
    />
  );
};

export default SamplingLocationsPanel;
