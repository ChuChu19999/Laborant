import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Branch } from '@/entities/Branch';
import type { Department } from '@/entities/Department';
import type { Laboratory } from '@/entities/Laboratory';

type BreadcrumbItem = { label: string; onClick?: () => void };

type UseSamplingLocationsPanelNavigationParams = {
  labId: number | undefined;
  deptId: number | undefined;
  laboratory: Laboratory | undefined;
  department: Department | null;
  selectedBranch: Branch | null;
};

/** Навигация drill-down и breadcrumbs для мест отбора проб. */
export const useSamplingLocationsPanelNavigation = ({
  labId,
  deptId,
  laboratory,
  department,
  selectedBranch,
}: UseSamplingLocationsPanelNavigationParams) => {
  const navigate = useNavigate();

  const handleLaboratoryClick = (lab: Laboratory) => {
    void navigate(`/sampling-locations/laboratory/${lab.id}`);
  };

  const handleDepartmentClick = (dept: Department) => {
    if (labId) {
      void navigate(`/sampling-locations/laboratory/${labId}/department/${dept.id}`);
    }
  };

  const handleBack = () => {
    if (deptId && labId) {
      void navigate(`/sampling-locations/laboratory/${labId}`);
    } else if (labId) {
      void navigate('/sampling-locations');
    } else {
      void navigate('/');
    }
  };

  const navigateHome = () => {
    void navigate('/');
  };

  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      {
        label: 'Главная',
        onClick: () => {
          void navigate('/');
        },
      },
      {
        label: 'Места отбора проб',
        onClick: () => {
          void navigate('/sampling-locations');
        },
      },
    ];

    if (laboratory) {
      items.push({
        label: laboratory.name,
        onClick:
          deptId || selectedBranch
            ? () => {
                void navigate(`/sampling-locations/laboratory/${labId}`);
              }
            : undefined,
      });
    }

    if (department) {
      items.push({
        label: department.name,
        onClick: selectedBranch
          ? () => {
              void navigate(`/sampling-locations/laboratory/${labId}/department/${deptId}`);
            }
          : undefined,
      });
    }

    return items;
  }, [navigate, laboratory, department, labId, deptId, selectedBranch]);

  return {
    breadcrumbs,
    handleLaboratoryClick,
    handleDepartmentClick,
    handleBack,
    navigateHome,
  };
};
