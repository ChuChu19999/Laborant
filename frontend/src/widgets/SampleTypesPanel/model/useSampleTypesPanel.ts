import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDepartmentsByLaboratory, type Department } from '@/entities/Department';
import { useLaboratories, useLaboratory, type Laboratory } from '@/entities/Laboratory';
import { useCan, useScopeAccess } from '@/entities/Role';
import { useSampleTypesList } from '@/entities/SampleType';
import { useSampleTypesPanelModals } from './useSampleTypesPanelModals';

/** Оркестрация экрана типов проб: Lab→Dept, данные, права, модалки. */
export const useSampleTypesPanel = (labId?: number, deptId?: number) => {
  const navigate = useNavigate();
  const { canAccessFeature } = useScopeAccess();
  const canCreate = useCan('sample_types', 'create', labId, deptId);
  const canUpdate = useCan('sample_types', 'update', labId, deptId);
  const canDelete = useCan('sample_types', 'delete', labId, deptId);

  const { data: laboratories } = useLaboratories(!labId);
  const { data: laboratory } = useLaboratory(labId, !!labId);
  const { data: departments } = useDepartmentsByLaboratory(labId, !!labId);
  const showList = !!labId && (!!deptId || !departments || departments.length === 0);
  const { data, isLoading } = useSampleTypesList(labId, deptId, showList);
  const modals = useSampleTypesPanelModals();

  const handleLaboratoryClick = (item: Laboratory) => {
    void navigate(`/sample-types/laboratory/${item.id}`);
  };

  const handleDepartmentClick = (item: Department) => {
    void navigate(`/sample-types/laboratory/${labId}/department/${item.id}`);
  };

  const handleBack = () => {
    if (deptId && departments && departments.length > 0) {
      void navigate(`/sample-types/laboratory/${labId}`);
    } else {
      void navigate('/sample-types');
    }
  };

  const breadcrumbs = useMemo((): { label: string; onClick?: () => void }[] => {
    const items: { label: string; onClick?: () => void }[] = [
      {
        label: 'Главная',
        onClick: () => {
          void navigate('/');
        },
      },
      {
        label: 'Типы проб',
        onClick: () => {
          void navigate('/sample-types');
        },
      },
    ];

    if (laboratory) {
      items.push({
        label: laboratory.name,
        onClick: deptId
          ? () => {
              void navigate(`/sample-types/laboratory/${labId}`);
            }
          : undefined,
      });
    }

    if (deptId && departments) {
      const department = departments.find(d => d.id === deptId);
      if (department) {
        items.push({ label: department.name });
      }
    }

    return items;
  }, [departments, deptId, labId, laboratory, navigate]);

  const pageTitle =
    deptId && departments
      ? departments.find(d => d.id === deptId)?.name || 'Типы проб'
      : laboratory?.name || 'Типы проб';

  return {
    labId,
    deptId,
    canAccessFeature,
    canCreate,
    canUpdate,
    canDelete,
    laboratories,
    departments,
    items: data?.items ?? [],
    isLoading: showList && isLoading,
    showList,
    modals,
    breadcrumbs,
    pageTitle,
    handleLaboratoryClick,
    handleDepartmentClick,
    handleBack,
    navigateHome: () => {
      void navigate('/');
    },
  };
};
