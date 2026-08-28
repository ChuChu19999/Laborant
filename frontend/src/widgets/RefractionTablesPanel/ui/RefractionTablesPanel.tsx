import { MassFractionOilRefractionDirectoryModal } from '@/features/MassFractionOilRefractionDirectoryModal';
import { DepartmentCard } from '@/entities/Department';
import { LaboratoryCard } from '@/entities/Laboratory';
import { Layout } from '@/shared/ui/Layout';
import { LoadingCard } from '@/shared/ui/LoadingCard';
import { NavigationBar } from '@/shared/ui/NavigationBar';
import {
  REFRACTION_SECTION_TITLE,
  useRefractionTablesPanel,
} from '../model/useRefractionTablesPanel';
import './RefractionTablesPanel.css';

const RefractionTablesPanel = () => {
  const {
    labId,
    deptId,
    canAccessFeature,
    canUpdate,
    laboratories,
    laboratory,
    departments,
    departmentsList,
    refractionMethods,
    methodsLoading,
    selectedMethod,
    isModalOpen,
    breadcrumbs,
    title,
    handleLaboratoryClick,
    handleDepartmentClick,
    handleBack,
    handleMethodClick,
    closeModal,
    navigateHome,
  } = useRefractionTablesPanel();

  if (!labId && laboratories?.items) {
    return (
      <Layout title={REFRACTION_SECTION_TITLE}>
        <NavigationBar breadcrumbs={breadcrumbs} onBack={navigateHome} showBack={true} />
        <div className="refraction-tables-panel-laboratories">
          <div className="refraction-tables-panel-laboratories-grid">
            {laboratories.items.map(item => (
              <LaboratoryCard
                key={item.id}
                laboratory={item}
                onClick={handleLaboratoryClick}
                showActions={false}
                disabled={!canAccessFeature('refraction_tables', 'read', item.id)}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (labId && !deptId && departments == null) {
    return (
      <Layout title={REFRACTION_SECTION_TITLE}>
        <NavigationBar breadcrumbs={breadcrumbs} onBack={handleBack} showBack={true} />
        <LoadingCard loading />
      </Layout>
    );
  }

  if (labId && !deptId && departmentsList.length > 0) {
    return (
      <Layout title={laboratory?.name || REFRACTION_SECTION_TITLE}>
        <NavigationBar breadcrumbs={breadcrumbs} onBack={handleBack} showBack={true} />
        <div className="refraction-tables-panel-departments">
          <div className="refraction-tables-panel-departments-grid">
            {departmentsList.map((department, index) => (
              <DepartmentCard
                key={department.id}
                department={department}
                onClick={handleDepartmentClick}
                showActions={false}
                iconIndex={index}
                disabled={!canAccessFeature('refraction_tables', 'read', labId, department.id)}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={title}>
      <NavigationBar breadcrumbs={breadcrumbs} onBack={handleBack} showBack={true} />
      <div className="refraction-tables-panel-content">
        {methodsLoading ? (
          <LoadingCard loading />
        ) : refractionMethods.length === 0 ? (
          <p className="refraction-tables-panel-empty">Нет методов «Массовая доля нефти».</p>
        ) : (
          <div className="refraction-tables-panel-methods">
            {refractionMethods.map(method => {
              const groupName = method.groups?.[0]?.name;
              const label = groupName ? `${groupName}: ${method.name}` : method.name;
              return (
                <button
                  key={method.id}
                  type="button"
                  className="refraction-tables-panel-method-card"
                  onClick={() => handleMethodClick(method)}
                >
                  <span className="refraction-tables-panel-method-name">{label}</span>
                  <span className="refraction-tables-panel-method-nd">{method.nd_code}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {isModalOpen && selectedMethod && (
        <MassFractionOilRefractionDirectoryModal
          open={isModalOpen}
          onClose={closeModal}
          researchMethodId={selectedMethod.id}
          methodName={selectedMethod.name}
          canUpdate={canUpdate}
        />
      )}
    </Layout>
  );
};

export default RefractionTablesPanel;
