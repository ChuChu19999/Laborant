import { useParams, Navigate } from 'react-router-dom';
import { SamplingLocationsPanel } from '@/widgets/SamplingLocationsPanel';
import { useScopeAccess } from '@/entities/Role';

const SamplingLocationsPage = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
  const { canAccessFeatureRoute } = useScopeAccess();

  if (!canAccessFeatureRoute('sampling_locations', 'read', labId, deptId)) {
    return <Navigate to="/403" replace />;
  }

  return <SamplingLocationsPanel />;
};

export default SamplingLocationsPage;
