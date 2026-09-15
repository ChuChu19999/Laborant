import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDepartmentsByLaboratory, type Department } from '@/entities/Department';
import { useLaboratories, useLaboratory, type Laboratory } from '@/entities/Laboratory';
import { useCan, useScopeAccess } from '@/entities/Role';
import { useTestPurposesList } from '@/entities/TestPurpose';
import { useTestPurposesPanelModals } from './useTestPurposesPanelModals';

/** Оркестрация экрана целей испытаний: Lab→Dept, данные, права, модалки. */
export const useTestPurposesPanel = (labId?: number, deptId?: number) => {
  const navigate = useNavigate();
  const { canAccessFeature } = useScopeAccess();
  const canCreate = useCan('test_purposes', 'create', labId, deptId);
  const canUpdate = useCan('test_purposes', 'update', labId, deptId);
  const canDelete = useCan('test_purposes', 'delete', labId, deptId);

  const { data: laboratories } = useLaboratories(!labId);
  const { data: laboratory } = useLaboratory(labId, !!labId);
  const { data: departments } = useDepartmentsByLaboratory(labId, !!labId);
  const showList = !!labId && (!!deptId || !departments || departments.length === 0);
  const { data, isLoading } = useTestPurposesList(labId, deptId, showList);
  const modals = useTestPurposesPanelModals();

  const handleLaboratoryClick = (item: Laboratory) => {
    void navigate(`/test-purposes/laboratory/${item.id}`);
  };

  const handleDepartmentClick = (item: Department) => {
    void navigate(`/test-purposes/laboratory/${labId}/department/${item.id}`);
  };

  const handleBack = () => {
    if (deptId && departments && departments.length > 0) {
      void navigate(`/test-purposes/laboratory/${labId}`);
    } else {
      void navigate('/test-purposes');
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
        label: 'Цели испытаний',
        onClick: () => {
          void navigate('/test-purposes');
        },
      },
    ];

    if (laboratory) {
      items.push({
        label: laboratory.name,
        onClick: deptId
          ? () => {
              void navigate(`/test-purposes/laboratory/${labId}`);
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
      ? departments.find(d => d.id === deptId)?.name || 'Цели испытаний'
      : laboratory?.name || 'Цели испытаний';

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
