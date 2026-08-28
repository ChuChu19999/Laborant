import { useParams, Navigate } from 'react-router-dom';
import { AdminWorkspace } from '@/widgets/AdminWorkspace';
import { useScopeAccess } from '@/entities/Role';

const AdminPage = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
  const { canAccessFeatureRoute } = useScopeAccess();

  if (!canAccessFeatureRoute('laboratory_management', 'access', labId, deptId)) {
    return <Navigate to="/403" replace />;
  }

  return <AdminWorkspace />;
};

export default AdminPage;
