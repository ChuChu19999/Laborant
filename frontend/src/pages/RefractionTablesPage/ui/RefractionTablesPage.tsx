import { useParams, Navigate } from 'react-router-dom';
import { RefractionTablesPanel } from '@/widgets/RefractionTablesPanel';
import { useScopeAccess } from '@/entities/Role';

const RefractionTablesPage = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
  const { canAccessFeatureRoute } = useScopeAccess();

  if (!canAccessFeatureRoute('refraction_tables', 'read', labId, deptId)) {
    return <Navigate to="/403" replace />;
  }

  return <RefractionTablesPanel />;
};

export default RefractionTablesPage;
