import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingCard } from '../../../features/Cards';
import {
  laboratoryApi,
  type LaboratoryResponse,
  type DepartmentResponse,
} from '../../../shared/api/laboratory';
import { LaboratoryCard, DepartmentCard } from '../../../shared/ui/Card';
import { NavigationBar } from '../../NavigationBar';
import './LaboratoryDepartmentSelector.css';

export type ViewMode = 'laboratories' | 'departments' | 'selected';

interface LaboratoryDepartmentSelectorProps {
  pageTitle: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedLaboratory: { id: number; name: string } | null;
  selectedDepartment: { id: number; name: string } | null;
  onLaboratorySelect: (laboratory: { id: number; name: string }) => void;
  onDepartmentSelect: (department: { id: number; name: string }) => void;
  onBackToLaboratories: () => void;
  onBackToDepartments: () => void;
  requireDepartment?: boolean;
}

const LaboratoryDepartmentSelector = ({
  pageTitle,
  viewMode,
  onViewModeChange,
  selectedLaboratory,
  onLaboratorySelect,
  onDepartmentSelect,
  onBackToLaboratories,
  requireDepartment = false,
}: LaboratoryDepartmentSelectorProps) => {
  // Запрос списка лабораторий
  const { data: laboratoriesData, isLoading: isLoadingLaboratories } = useQuery({
    queryKey: ['laboratories'],
    queryFn: () => laboratoryApi.listLaboratories({ page: 1, page_size: 100 }),
    enabled: viewMode === 'laboratories',
  });

  // Запрос подразделений выбранной лаборатории
  const { data: departmentsData, isLoading: isLoadingDepartments } = useQuery({
    queryKey: ['departments', selectedLaboratory?.id],
    queryFn: () => laboratoryApi.getDepartmentsByLaboratory(selectedLaboratory!.id),
    enabled: viewMode === 'departments' && selectedLaboratory !== null,
  });

  const handleSelectLaboratory = (laboratory: LaboratoryResponse) => {
    onLaboratorySelect({ id: laboratory.id, name: laboratory.name });
    onViewModeChange('departments');
  };

  const handleSelectDepartment = (department: DepartmentResponse) => {
    onDepartmentSelect({ id: department.id, name: department.name });
    onViewModeChange('selected');
  };

  // Автоматический переход к 'selected', если подразделения не требуются и их нет
  useEffect(() => {
    if (
      viewMode === 'departments' &&
      selectedLaboratory &&
      !isLoadingDepartments &&
      departmentsData &&
      departmentsData.length === 0 &&
      !requireDepartment
    ) {
      onViewModeChange('selected');
    }
  }, [
    viewMode,
    selectedLaboratory,
    isLoadingDepartments,
    departmentsData,
    requireDepartment,
    onViewModeChange,
  ]);

  if (isLoadingLaboratories || isLoadingDepartments) {
    return (
      <div style={{ position: 'relative' }}>
        <LoadingCard loading={isLoadingLaboratories || isLoadingDepartments} />
      </div>
    );
  }

  if (viewMode === 'laboratories') {
    return (
      <div className="laboratory-department-selector">
        <div className="laboratories-container">
          <NavigationBar breadcrumbs={[{ label: pageTitle }]} showBack={false} />
          <div className="laboratories-grid">
            {(laboratoriesData?.items || []).map(laboratory => (
              <LaboratoryCard
                key={laboratory.id}
                laboratory={
                  laboratory as {
                    name: string;
                    description?: string;
                    full_name?: string;
                    laboratory_location?: string;
                  }
                }
                onClick={handleSelectLaboratory as (laboratory: { name: string }) => void}
                showActions={false}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'departments' && selectedLaboratory) {
    const departments = departmentsData || [];

    // Если подразделения не требуются и их нет, виджет уже переключился на 'selected' через useEffect
    if (!requireDepartment && departments.length === 0) {
      return null;
    }

    return (
      <div className="laboratory-department-selector">
        <div className="departments-container">
          <NavigationBar
            breadcrumbs={[
              { label: pageTitle, onClick: onBackToLaboratories },
              { label: selectedLaboratory.name },
            ]}
            onBack={onBackToLaboratories}
          />
          <div className="departments-grid">
            {departments.map((department, index) => (
              <DepartmentCard
                key={department.id}
                department={department as { name: string; laboratory_location?: string }}
                onClick={handleSelectDepartment as (department: { name: string }) => void}
                showActions={false}
                iconIndex={index}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // В режиме 'selected' виджет не рендерится, родительский компонент показывает контент
  return null;
};

export default LaboratoryDepartmentSelector;
