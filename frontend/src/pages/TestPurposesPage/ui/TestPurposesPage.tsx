import { Navigate, useParams } from 'react-router-dom';
import { TestPurposesPanel } from '@/widgets/TestPurposesPanel';
import { useScopeAccess } from '@/entities/Role';

const TestPurposesPage = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
  const { canAccessFeatureRoute } = useScopeAccess();

  if (!canAccessFeatureRoute('test_purposes', 'read', labId, deptId)) {
    return <Navigate to="/403" replace />;
  }

  return <TestPurposesPanel />;
};

export default TestPurposesPage;
