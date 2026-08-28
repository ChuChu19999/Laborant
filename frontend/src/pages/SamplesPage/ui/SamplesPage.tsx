import { useParams, Navigate } from 'react-router-dom';
import { SamplesPanel } from '@/widgets/SamplesPanel';
import { useScopeAccess } from '@/entities/Role';

const SamplesPage = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
  const { canAccessFeatureRoute } = useScopeAccess();

  if (!canAccessFeatureRoute('navigation', 'samples', labId, deptId)) {
    return <Navigate to="/403" replace />;
  }

  return <SamplesPanel />;
};

export default SamplesPage;
