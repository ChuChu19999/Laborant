import { Navigate, useParams } from 'react-router-dom';
import { SampleTypesPanel } from '@/widgets/SampleTypesPanel';
import { useScopeAccess } from '@/entities/Role';

const SampleTypesPage = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
  const { canAccessFeatureRoute } = useScopeAccess();

  if (!canAccessFeatureRoute('sample_types', 'read', labId, deptId)) {
    return <Navigate to="/403" replace />;
  }

  return <SampleTypesPanel />;
};

export default SampleTypesPage;
