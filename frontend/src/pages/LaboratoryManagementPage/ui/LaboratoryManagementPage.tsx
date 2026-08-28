import { useNavigate, Navigate } from 'react-router-dom';
import { LaboratoryManagement } from '@/widgets/LaboratoryManagement';
import { useCan } from '@/entities/Role';

const LaboratoryManagementPage = () => {
  const navigate = useNavigate();
  const canAccess = useCan('laboratory_management', 'access');

  if (!canAccess) {
    return <Navigate to="/403" replace />;
  }

  return <LaboratoryManagement onBack={() => navigate('/', { replace: true })} />;
};

export default LaboratoryManagementPage;
