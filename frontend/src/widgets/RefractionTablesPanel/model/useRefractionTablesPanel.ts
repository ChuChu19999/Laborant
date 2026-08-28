import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDepartmentsByLaboratory } from '@/entities/Department';
import { useLaboratories, useLaboratory } from '@/entities/Laboratory';
import {
  isMassFractionOilResearchMethod,
  useResearchMethodsForRefractionTables,
} from '@/entities/ResearchMethod';
import { useCan, useScopeAccess } from '@/entities/Role';
import type { Department } from '@/entities/Department';
import type { Laboratory } from '@/entities/Laboratory';
import type { ResearchMethod } from '@/entities/ResearchMethod';

export const REFRACTION_SECTION_TITLE = 'Градуировочный график';

/** Оркестрация экрана градуировочных графиков: навигация, данные, модалка. */
export const useRefractionTablesPanel = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const navigate = useNavigate();
  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;
  const { canAccessFeature } = useScopeAccess();
  const canUpdate = useCan('refraction_tables', 'update', labId, deptId);

  const [selectedMethod, setSelectedMethod] = useState<ResearchMethod | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: laboratories } = useLaboratories(!labId);
  const { data: laboratory } = useLaboratory(labId, !!labId);
  const { data: departments } = useDepartmentsByLaboratory(labId, !!labId);

  const departmentsList = useMemo(
    () => (departments ?? []).filter(d => !d.deleted_at),
    [departments]
  );

  const methodsEnabled =
    !!labId && (deptId != null || (departments != null && departmentsList.length === 0));

  const { data: methodsData, isLoading: methodsLoading } = useResearchMethodsForRefractionTables(
    labId,
    deptId,
    methodsEnabled
  );

  const refractionMethods = useMemo(() => {
    const items = methodsData?.items ?? [];
    return items.filter(method => !method.deleted_at && isMassFractionOilResearchMethod(method));
  }, [methodsData]);

  const handleLaboratoryClick = (lab: Laboratory) => {
    void navigate(`/refraction-tables/laboratory/${lab.id}`);
  };

  const handleDepartmentClick = (department: Department) => {
    void navigate(`/refraction-tables/laboratory/${labId}/department/${department.id}`);
  };

  const handleBack = () => {
    if (deptId && departmentsList.length > 0) {
      void navigate(`/refraction-tables/laboratory/${labId}`);
    } else {
      void navigate('/refraction-tables');
    }
  };

  const handleMethodClick = (method: ResearchMethod) => {
    setSelectedMethod(method);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedMethod(null);
  };

  const navigateHome = () => {
    void navigate('/');
  };

  const breadcrumbs: { label: string; onClick?: () => void }[] = [
    {
      label: 'Главная',
      onClick: () => {
        void navigate('/');
      },
    },
    {
      label: REFRACTION_SECTION_TITLE,
      onClick: () => {
        void navigate('/refraction-tables');
      },
    },
  ];

  if (laboratory) {
    breadcrumbs.push({
      label: laboratory.name,
      onClick: deptId
        ? () => {
            void navigate(`/refraction-tables/laboratory/${labId}`);
          }
        : undefined,
    });
  }

  if (deptId && departments) {
    const department = departments.find(d => d.id === deptId);
    if (department) {
      breadcrumbs.push({ label: department.name });
    }
  }

  const title =
    (deptId && departmentsList.find(d => d.id === deptId)?.name) ||
    laboratory?.name ||
    REFRACTION_SECTION_TITLE;

  return {
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
  };
};
