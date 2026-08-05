import React from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../shared/ui/Layout';
import { LaboratoryManagement } from '../../widgets/LaboratoryManagement';

const LaboratoryManagementPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Layout title="Управление лабораториями">
      <LaboratoryManagement onBack={() => navigate('/', { replace: true })} />
    </Layout>
  );
};

export default LaboratoryManagementPage;
