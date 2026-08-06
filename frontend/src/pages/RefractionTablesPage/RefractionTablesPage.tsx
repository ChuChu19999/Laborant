import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { LoadingCard } from '../../features/Cards';
import { MassFractionOilRefractionDirectoryModal } from '../../features/Modals';
import { laboratoriesApi } from '../../shared/api/laboratories';
import { researchApi } from '../../shared/api/research';
import { useCan, useScopeAccess } from '../../shared/lib/permissions';
import { useAutoRefetchQuery } from '../../shared/model/lib/useQuery';
import { LaboratoryCard, DepartmentCard } from '../../shared/ui/Cards';
import Layout from '../../shared/ui/Layout';
import { isMassFractionOilResearchMethod } from '../../shared/utils/massFractionOilMethod';
import { NavigationBar } from '../../widgets/NavigationBar';
import type { Laboratory, Department } from '../../shared/api/laboratories';
import type { ResearchMethod } from '../../shared/api/research';
import './RefractionTablesPage.css';

const RefractionTablesPage: React.FC = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const navigate = useNavigate();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
  const { canAccessLaboratory, canAccessDepartment, canAccessRouteScope } = useScopeAccess();
  const canUpdate = useCan('refraction_tables', 'update', labId, deptId);

  const [selectedMethod, setSelectedMethod] = useState<ResearchMethod | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: laboratories } = useAutoRefetchQuery<{ items: Laboratory[] }>(
    ['laboratories'],
    () => laboratoriesApi.getLaboratories(),
    { enabled: !labId }
  );

  const { data: laboratory } = useAutoRefetchQuery<Laboratory>(
    ['laboratory', labId],
    () => laboratoriesApi.getLaboratory(labId!),
    { enabled: !!labId }
  );

  const { data: departments } = useAutoRefetchQuery<Department[]>(
    ['departments', 'by-laboratory', labId],
    () => laboratoriesApi.getDepartmentsByLaboratory(labId!),
    { enabled: !!labId }
  );

  const departmentsList = useMemo(
    () => (departments ?? []).filter(d => !d.deleted_at),
    [departments]
  );

  const { data: methodsData, isLoading: methodsLoading } = useAutoRefetchQuery(
    ['research-methods', 'refraction-tables', labId, deptId],
    () =>
      researchApi.getResearchMethods({
        laboratory_id: labId,
        department_id: deptId,
      }),
    {
      enabled: !!labId && (deptId != null || (departments != null && departmentsList.length === 0)),
    }
  );

  const refractionMethods = useMemo(() => {
    const items = methodsData?.items ?? [];
    return items.filter(method => !method.deleted_at && isMassFractionOilResearchMethod(method));
  }, [methodsData]);

  const handleLaboratoryClick = useCallback(
    (lab: Laboratory) => {
      navigate(`/refraction-tables/laboratory/${lab.id}`);
    },
    [navigate]
  );

  const handleDepartmentClick = useCallback(
    (department: Department) => {
      navigate(`/refraction-tables/laboratory/${labId}/department/${department.id}`);
    },
    [navigate, labId]
  );

  const handleBack = useCallback(() => {
    if (deptId && departmentsList.length > 0) {
      navigate(`/refraction-tables/laboratory/${labId}`);
    } else {
      navigate('/refraction-tables');
    }
  }, [deptId, departmentsList.length, labId, navigate]);

  const handleMethodClick = useCallback((method: ResearchMethod) => {
    setSelectedMethod(method);
    setIsModalOpen(true);
  }, []);

  const getBreadcrumbs = (): Array<{ label: string; onClick?: () => void }> => {
    const breadcrumbs: Array<{ label: string; onClick?: () => void }> = [
      { label: 'Главная', onClick: () => navigate('/') },
      { label: 'Градуировочный график', onClick: () => navigate('/refraction-tables') },
    ];

    if (laboratory) {
      breadcrumbs.push({
        label: laboratory.name,
        onClick: deptId ? () => navigate(`/refraction-tables/laboratory/${labId}`) : undefined,
      });
    }

    if (deptId && departments) {
      const department = departments.find(d => d.id === deptId);
      if (department) {
        breadcrumbs.push({ label: department.name });
      }
    }

    return breadcrumbs;
  };

  if (!canAccessRouteScope(labId, deptId)) {
    return <Navigate to="/403" replace />;
  }

  if (!labId && laboratories?.items) {
    return (
      <Layout title="Градуировочный график">
        <NavigationBar
          breadcrumbs={getBreadcrumbs()}
          onBack={() => navigate('/')}
          showBack={true}
        />
        <div className="refraction-tables-page-laboratories">
          <div className="refraction-tables-page-laboratories-grid">
            {laboratories.items.map(item => (
              <LaboratoryCard
                key={item.id}
                laboratory={item}
                onClick={handleLaboratoryClick}
                showActions={false}
                disabled={!canAccessLaboratory(item.id)}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (labId && !deptId && departments == null) {
    return (
      <Layout title="Градуировочный график">
        <NavigationBar breadcrumbs={getBreadcrumbs()} onBack={handleBack} showBack={true} />
        <LoadingCard loading />
      </Layout>
    );
  }

  if (labId && !deptId && departmentsList.length > 0) {
    return (
      <Layout title={laboratory?.name || 'Градуировочный график'}>
        <NavigationBar breadcrumbs={getBreadcrumbs()} onBack={handleBack} showBack={true} />
        <div className="refraction-tables-page-departments">
          <div className="refraction-tables-page-departments-grid">
            {departmentsList.map((department, index) => (
              <DepartmentCard
                key={department.id}
                department={department}
                onClick={handleDepartmentClick}
                showActions={false}
                iconIndex={index}
                disabled={!canAccessDepartment(labId, department.id)}
              />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const title =
    (deptId && departmentsList.find(d => d.id === deptId)?.name) ||
    laboratory?.name ||
    'Градуировочный график';

  return (
    <Layout title={title}>
      <NavigationBar breadcrumbs={getBreadcrumbs()} onBack={handleBack} showBack={true} />
      <div className="refraction-tables-page-content">
        {methodsLoading ? (
          <LoadingCard loading />
        ) : refractionMethods.length === 0 ? (
          <p className="refraction-tables-page-empty">
            Нет методов «Массовая доля нефти» в выбранной области.
          </p>
        ) : (
          <div className="refraction-tables-page-methods">
            {refractionMethods.map(method => {
              const groupName = method.groups?.[0]?.name;
              const label = groupName ? `${groupName}: ${method.name}` : method.name;
              return (
                <button
                  key={method.id}
                  type="button"
                  className="refraction-tables-page-method-card"
                  onClick={() => handleMethodClick(method)}
                >
                  <span className="refraction-tables-page-method-name">{label}</span>
                  <span className="refraction-tables-page-method-nd">{method.nd_code}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {isModalOpen && selectedMethod && (
        <MassFractionOilRefractionDirectoryModal
          open={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedMethod(null);
          }}
          researchMethodId={selectedMethod.id}
          methodName={selectedMethod.name}
          canUpdate={canUpdate}
        />
      )}
    </Layout>
  );
};

export default RefractionTablesPage;
