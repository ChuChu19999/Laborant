import { useParams, Navigate } from 'react-router-dom';
import { NdNormsPanel } from '@/widgets/NdNormsPanel';
import { useScopeAccess } from '@/entities/Role';

const NdNormsPage = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
  const { canAccessFeatureRoute } = useScopeAccess();

  if (!canAccessFeatureRoute('nd_norms', 'read', labId, deptId)) {
    return <Navigate to="/403" replace />;
  }

  return <NdNormsPanel />;
};

export default NdNormsPage;
