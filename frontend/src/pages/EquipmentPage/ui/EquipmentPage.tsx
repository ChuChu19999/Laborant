import { useParams, Navigate } from 'react-router-dom';
import { EquipmentPanel } from '@/widgets/EquipmentPanel';
import { useScopeAccess } from '@/entities/Role';

const EquipmentPage = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
  const { canAccessFeatureRoute } = useScopeAccess();

  if (!canAccessFeatureRoute('equipment', 'read', labId, deptId)) {
    return <Navigate to="/403" replace />;
  }

  return <EquipmentPanel />;
};

export default EquipmentPage;
