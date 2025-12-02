import { useState } from 'react';
import Layout from '../../shared/ui/Layout/Layout';
import {
  LaboratoryDepartmentSelector,
  type ViewMode,
} from '../../widgets/LaboratoryDepartmentSelector';
import { NavigationBar } from '../../widgets/NavigationBar';
import './ReportsPage.css';

function ReportsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('laboratories');
  const [selectedLaboratory, setSelectedLaboratory] = useState<{ id: number; name: string } | null>(
    null
  );
  const [selectedDepartment, setSelectedDepartment] = useState<{ id: number; name: string } | null>(
    null
  );

  const handleSelectLaboratory = (laboratory: { id: number; name: string }) => {
    setSelectedLaboratory(laboratory);
  };

  const handleSelectDepartment = (department: { id: number; name: string }) => {
    setSelectedDepartment(department);
  };

  const handleBackToLaboratories = () => {
    setViewMode('laboratories');
    setSelectedLaboratory(null);
    setSelectedDepartment(null);
  };

  const handleBackToDepartments = () => {
    setViewMode('departments');
    setSelectedDepartment(null);
  };

  const handleBack = () => {
    if (selectedDepartment) {
      handleBackToDepartments();
    } else {
      handleBackToLaboratories();
    }
  };

  // Финальная страница с переданными параметрами
  if (viewMode === 'selected' && selectedLaboratory) {
    return (
      <Layout title={selectedDepartment ? selectedDepartment.name : selectedLaboratory.name}>
        <NavigationBar
          breadcrumbs={[
            {
              label: 'Отчеты',
              onClick: handleBackToLaboratories,
            },
            {
              label: selectedLaboratory.name,
              onClick: handleBackToDepartments,
            },
            ...(selectedDepartment
              ? [{ label: selectedDepartment.name, onClick: handleBackToDepartments }]
              : []),
          ]}
          onBack={handleBack}
          onHomeClick={handleBackToLaboratories}
        />
        <div style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>
          <div
            className="header-actions"
            style={{ padding: '20px', display: 'flex', justifyContent: 'flex-start' }}
          ></div>

          <div
            className="reports-list"
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '0 20px 20px 20px',
              marginTop: 0,
            }}
          ></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Отчеты">
      <LaboratoryDepartmentSelector
        pageTitle="Отчеты"
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedLaboratory={selectedLaboratory}
        selectedDepartment={selectedDepartment}
        onLaboratorySelect={handleSelectLaboratory}
        onDepartmentSelect={handleSelectDepartment}
        onBackToLaboratories={handleBackToLaboratories}
        onBackToDepartments={handleBackToDepartments}
        requireDepartment={false}
      />
    </Layout>
  );
}

export default ReportsPage;
