import { useParams, Navigate } from 'react-router-dom';
import { ProtocolsPanel } from '@/widgets/ProtocolsPanel';
import { useScopeAccess } from '@/entities/Role';

const ProtocolsPage = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
  const { canAccessFeatureRoute } = useScopeAccess();

  if (!canAccessFeatureRoute('protocols', 'read', labId, deptId)) {
    return <Navigate to="/403" replace />;
  }

  return <ProtocolsPanel />;
};

export default ProtocolsPage;
