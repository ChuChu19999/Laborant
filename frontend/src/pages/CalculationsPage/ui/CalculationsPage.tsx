import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { CalculationsWorkspace } from '@/widgets/CalculationsWorkspace';
import { useScopeAccess } from '@/entities/Role';
import { parseSearchParamInt } from '@/shared/lib/routing';

const CalculationsPage = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const [searchParams] = useSearchParams();
  const labId = laboratoryId
    ? parseInt(laboratoryId, 10)
    : parseSearchParamInt(searchParams.get('laboratory_id'));
  const deptId = departmentId
    ? parseInt(departmentId, 10)
    : parseSearchParamInt(searchParams.get('department_id'));
  const { canAccessFeatureRoute } = useScopeAccess();

  if (!canAccessFeatureRoute('calculations', 'execute', labId, deptId)) {
    return <Navigate to="/403" replace />;
  }

  return <CalculationsWorkspace />;
};

export default CalculationsPage;
