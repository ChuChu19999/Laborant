import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { BarChartOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { LoadingCard } from '../../../features/Cards';
import {
  CreateLaboratoryModal,
  EditLaboratoryModal,
  DeleteLaboratoryModal,
  CreateDepartmentModal,
  EditDepartmentModal,
  DeleteDepartmentModal,
  EditProtocolTemplateModal,
  EditReportTemplateModal,
  SelectionConditionsModal,
} from '../../../features/Modals';
import { laboratoriesApi } from '../../../shared/api/laboratories';
import { researchApi } from '../../../shared/api/research';
import { useScopeAccess } from '../../../shared/lib/permissions';
import { updateUrlParams } from '../../../shared/lib/urlParams';
import {
  LaboratoryCard,
  DepartmentCard,
  AddLaboratoryCard,
  AddDepartmentCard,
} from '../../../shared/ui/Cards';
import { NavigationBar } from '../../NavigationBar';
import type { Laboratory, Department } from '../../../shared/api/laboratories';
import type { MenuProps } from 'antd';
import './LaboratoryManagement.css';

interface LaboratoryManagementProps {
  onBack?: () => void;
}

type ViewMode = 'laboratories' | 'departments';

type SettingsScope = {
  laboratoryId: number;
  departmentId?: number;
  entityName?: string;
};

const LaboratoryManagement: React.FC<LaboratoryManagementProps> = ({ onBack }) => {
  const { canAccessLaboratory, canAccessDepartment } = useScopeAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isInitialMountRef = useRef(true);
  const previousSearchRef = useRef<string>(location.search);
  const isClearingRef = useRef<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('laboratories');
  const [selectedLaboratory, setSelectedLaboratory] = useState<Laboratory | null>(null);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCreateDeptModalOpen, setIsCreateDeptModalOpen] = useState(false);
  const [isEditDeptModalOpen, setIsEditDeptModalOpen] = useState(false);
  const [isDeleteDeptModalOpen, setIsDeleteDeptModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Laboratory | Department | null>(null);
  const [settingsScope, setSettingsScope] = useState<SettingsScope | null>(null);
  const [isProtocolTemplateModalOpen, setIsProtocolTemplateModalOpen] = useState(false);
  const [isReportTemplateModalOpen, setIsReportTemplateModalOpen] = useState(false);
  const [isSelectionConditionsModalOpen, setIsSelectionConditionsModalOpen] = useState(false);

  const fetchLaboratories = useCallback(async () => {
    try {
      setIsLoading(true);
      const allLaboratories: Laboratory[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await laboratoriesApi.getLaboratories({
          page,
          page_size: 100,
        });
        allLaboratories.push(...response.items.filter((lab: Laboratory) => !lab.deleted_at));
        hasMore = page < response.total_pages;
        page += 1;
      }

      setLaboratories(allLaboratories);
    } catch (error) {
      console.error('Ошибка при загрузке лабораторий:', error);
      message.error('Не удалось загрузить лаборатории');
      setLaboratories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async (laboratoryId: number) => {
    try {
      setIsLoading(true);
      const depts = await laboratoriesApi.getDepartmentsByLaboratory(laboratoryId);
      setDepartments(depts.filter((dept: Department) => !dept.deleted_at));
    } catch (error) {
      console.error('Ошибка при загрузке подразделений:', error);
      message.error('Не удалось загрузить подразделения');
      setDepartments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Есть ли методы на уровне лаборатории (без подразделений). */
  const laboratoryHasMethods = useCallback(async (laboratoryId: number): Promise<boolean> => {
    try {
      const response = await researchApi.getResearchMethods({
        laboratory_id: laboratoryId,
        page: 1,
        page_size: 1,
      });
      return response.total > 0;
    } catch (error) {
      console.error('Ошибка при проверке методов лаборатории:', error);
      return false;
    }
  }, []);

  /** Без подразделений, но с методами — сразу на страницу методов лаборатории. */
  const openLaboratoryWithoutDepartments = useCallback(
    async (laboratory: Laboratory): Promise<boolean> => {
      if (!laboratory.id) {
        return false;
      }
      const hasMethods = await laboratoryHasMethods(laboratory.id);
      if (!hasMethods) {
        return false;
      }
      navigate(`/admin/laboratory/${laboratory.id}`);
      return true;
    },
    [laboratoryHasMethods, navigate]
  );

  useEffect(() => {
    void fetchLaboratories();
  }, [fetchLaboratories]);

  // Инициализация из URL после загрузки лабораторий
  useEffect(() => {
    const currentSearch = location.search;
    const wasCleared = previousSearchRef.current !== '' && currentSearch === '';

    if (wasCleared) {
      isClearingRef.current = true;
      setViewMode('laboratories');
      setSelectedLaboratory(null);
      setDepartments([]);
      setTimeout(() => {
        isClearingRef.current = false;
      }, 100);
      previousSearchRef.current = currentSearch;
      return;
    }

    if (isInitialMountRef.current && laboratories.length > 0) {
      isInitialMountRef.current = false;
      const urlViewMode = searchParams.get('viewMode') as ViewMode | null;
      const urlLaboratoryId = searchParams.get('laboratoryId');

      if (urlViewMode === 'departments' && urlLaboratoryId) {
        const laboratoryId = parseInt(urlLaboratoryId, 10);
        if (!isNaN(laboratoryId) && canAccessLaboratory(laboratoryId)) {
          const lab = laboratories.find(l => l.id === laboratoryId);
          if (lab) {
            void (async () => {
              try {
                setIsLoading(true);
                const depts = await laboratoriesApi.getDepartmentsByLaboratory(laboratoryId);
                const activeDepartments = depts.filter((dept: Department) => !dept.deleted_at);
                if (activeDepartments.length === 0) {
                  const opened = await openLaboratoryWithoutDepartments(lab);
                  if (opened) {
                    return;
                  }
                }
                setSelectedLaboratory(lab);
                setViewMode('departments');
                setDepartments(activeDepartments);
              } catch (error) {
                console.error('Ошибка при открытии лаборатории из URL:', error);
                message.error('Не удалось открыть лабораторию');
              } finally {
                setIsLoading(false);
              }
            })();
            previousSearchRef.current = currentSearch;
            return;
          }
        }
      }
    }

    previousSearchRef.current = currentSearch;
  }, [
    laboratories,
    searchParams,
    location.search,
    canAccessLaboratory,
    openLaboratoryWithoutDepartments,
  ]);

  useEffect(() => {
    if (viewMode === 'laboratories' && !isInitialMountRef.current) {
      void fetchLaboratories();
    }
  }, [viewMode, fetchLaboratories]);

  // Если открыли лабораторию без подразделений, но методы уже есть — не показываем заглушку.
  useEffect(() => {
    if (
      viewMode !== 'departments' ||
      !selectedLaboratory?.id ||
      departments.length > 0 ||
      isLoading
    ) {
      return;
    }
    void openLaboratoryWithoutDepartments(selectedLaboratory);
  }, [
    viewMode,
    selectedLaboratory,
    departments.length,
    isLoading,
    openLaboratoryWithoutDepartments,
  ]);

  // Синхронизация состояния с URL
  useEffect(() => {
    if (isInitialMountRef.current) {
      return;
    }

    // Пропускаем синхронизацию, если происходит намеренная очистка параметров
    if (isClearingRef.current) {
      return;
    }

    const updates: Record<string, string | number | undefined | null> = {
      viewMode: viewMode === 'departments' ? 'departments' : undefined,
      laboratoryId: selectedLaboratory?.id || undefined,
    };

    const newParams = updateUrlParams(searchParams, updates);
    if (newParams.toString() !== searchParams.toString()) {
      setSearchParams(newParams, { replace: true });
    }
  }, [viewMode, selectedLaboratory, searchParams, setSearchParams]);

  const handleLaboratoryClick = async (laboratory: Laboratory) => {
    if (!laboratory.id) return;

    try {
      setIsLoading(true);
      const depts = await laboratoriesApi.getDepartmentsByLaboratory(laboratory.id);
      const activeDepartments = depts.filter((dept: Department) => !dept.deleted_at);

      if (activeDepartments.length === 0) {
        const opened = await openLaboratoryWithoutDepartments(laboratory);
        if (opened) {
          return;
        }
      }

      setSelectedLaboratory(laboratory);
      setViewMode('departments');
      setDepartments(activeDepartments);
    } catch (error) {
      console.error('Ошибка при открытии лаборатории:', error);
      message.error('Не удалось открыть лабораторию');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDepartmentClick = (department: Department) => {
    if (selectedLaboratory && department.id) {
      navigate(`/admin/laboratory/${selectedLaboratory.id}/department/${department.id}`);
    }
  };

  const handleBack = () => {
    if (viewMode === 'departments') {
      setViewMode('laboratories');
      setSelectedLaboratory(null);
      setDepartments([]);
      // Очищаем параметры из URL
      const newParams = updateUrlParams(searchParams, {
        viewMode: undefined,
        laboratoryId: undefined,
      });
      setSearchParams(newParams, { replace: true });
    } else if (onBack) {
      onBack();
    }
  };

  const handleEdit = (item: Laboratory | Department, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItem(item);
    if (viewMode === 'laboratories') {
      setIsEditModalOpen(true);
    } else {
      setIsEditDeptModalOpen(true);
    }
  };

  const handleDeleteClick = (item: Laboratory | Department, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItem(item);
    if (viewMode === 'laboratories') {
      setIsDeleteModalOpen(true);
    } else {
      setIsDeleteDeptModalOpen(true);
    }
  };

  const handleModalClose = () => {
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setIsDeleteModalOpen(false);
    setIsCreateDeptModalOpen(false);
    setIsEditDeptModalOpen(false);
    setIsDeleteDeptModalOpen(false);
    setSelectedItem(null);
  };

  const openSettingsForScope = useCallback((scope: SettingsScope) => {
    setSettingsScope(scope);
  }, []);

  const buildSettingsMenuItems = useCallback(
    (scope: SettingsScope): MenuProps['items'] => [
      {
        key: 'protocol-template',
        label: 'Шаблон протокола',
        onClick: () => {
          openSettingsForScope(scope);
          setIsProtocolTemplateModalOpen(true);
        },
      },
      {
        key: 'report-template',
        label: 'Шаблоны отчётов',
        onClick: () => {
          openSettingsForScope(scope);
          setIsReportTemplateModalOpen(true);
        },
      },
      {
        key: 'selection-conditions',
        label: 'Условия отбора',
        onClick: () => {
          openSettingsForScope(scope);
          setIsSelectionConditionsModalOpen(true);
        },
      },
    ],
    [openSettingsForScope]
  );

  const handleSuccess = () => {
    if (viewMode === 'laboratories') {
      fetchLaboratories();
    } else {
      if (selectedLaboratory) {
        fetchDepartments(selectedLaboratory.id);
      }
    }
  };

  const breadcrumbs =
    viewMode === 'departments' && selectedLaboratory
      ? [
          { label: 'Главная', onClick: onBack },
          { label: 'Управление лабораториями', onClick: handleBack },
          { label: selectedLaboratory.name },
        ]
      : [{ label: 'Главная', onClick: onBack }, { label: 'Управление лабораториями' }];

  if (isLoading && laboratories.length === 0 && departments.length === 0) {
    return <LoadingCard loading={isLoading} />;
  }

  return (
    <div className="laboratory-management">
      <NavigationBar
        breadcrumbs={breadcrumbs}
        onBack={viewMode === 'departments' ? handleBack : onBack}
        showBack={true}
      />

      {viewMode === 'laboratories' ? (
        <div className="laboratories-grid">
          {laboratories.map(laboratory => (
            <LaboratoryCard
              key={laboratory.id}
              laboratory={laboratory}
              onClick={handleLaboratoryClick}
              showActions={true}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              disabled={!canAccessLaboratory(laboratory.id)}
              settingsMenuItems={
                !(laboratory.departments_count && laboratory.departments_count > 0)
                  ? buildSettingsMenuItems({
                      laboratoryId: laboratory.id,
                      entityName: laboratory.name,
                    })
                  : undefined
              }
            />
          ))}
          <AddLaboratoryCard onClick={() => setIsCreateModalOpen(true)} />
        </div>
      ) : isLoading && viewMode === 'departments' ? (
        <LoadingCard loading={isLoading} />
      ) : departments.length === 0 ? (
        <div className="empty-departments-choice">
          <div className="empty-departments-content">
            <h2 className="empty-departments-title">В лаборатории нет подразделений</h2>
            <p className="empty-departments-description">Выберите действие для начала работы</p>
            <div className="empty-departments-actions">
              <button
                className="empty-departments-button calculation-button"
                onClick={() => {
                  if (selectedLaboratory && selectedLaboratory.id) {
                    navigate(`/admin/laboratory/${selectedLaboratory.id}`);
                  }
                }}
              >
                <div className="empty-departments-button-content">
                  <BarChartOutlined className="empty-departments-button-icon" />
                  <h3 className="empty-departments-button-text">Добавить метод расчета</h3>
                </div>
              </button>
              <AddDepartmentCard
                text="Добавить первое подразделение"
                onClick={() => setIsCreateDeptModalOpen(true)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="departments-grid">
          {departments.map((department, index) => (
            <DepartmentCard
              key={department.id}
              department={department}
              onClick={handleDepartmentClick}
              showActions={true}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              iconIndex={index}
              disabled={
                !selectedLaboratory || !canAccessDepartment(selectedLaboratory.id, department.id)
              }
              settingsMenuItems={
                selectedLaboratory
                  ? buildSettingsMenuItems({
                      laboratoryId: selectedLaboratory.id,
                      departmentId: department.id,
                      entityName: department.name,
                    })
                  : undefined
              }
            />
          ))}
          <AddDepartmentCard onClick={() => setIsCreateDeptModalOpen(true)} />
        </div>
      )}

      {/* Модальные окна для лабораторий */}
      <CreateLaboratoryModal
        open={isCreateModalOpen}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
      />

      <EditLaboratoryModal
        open={isEditModalOpen}
        laboratory={selectedItem && 'id' in selectedItem ? (selectedItem as Laboratory) : null}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
      />

      <DeleteLaboratoryModal
        open={isDeleteModalOpen}
        laboratory={selectedItem && 'id' in selectedItem ? (selectedItem as Laboratory) : null}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
      />

      {/* Модальные окна для подразделений */}
      {selectedLaboratory && (
        <CreateDepartmentModal
          open={isCreateDeptModalOpen}
          laboratoryId={selectedLaboratory.id}
          onClose={handleModalClose}
          onSuccess={handleSuccess}
        />
      )}

      <EditDepartmentModal
        open={isEditDeptModalOpen}
        department={selectedItem && 'id' in selectedItem ? (selectedItem as Department) : null}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
      />

      <DeleteDepartmentModal
        open={isDeleteDeptModalOpen}
        department={selectedItem && 'id' in selectedItem ? (selectedItem as Department) : null}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
      />

      {isProtocolTemplateModalOpen && settingsScope && (
        <EditProtocolTemplateModal
          open={isProtocolTemplateModalOpen}
          onClose={() => setIsProtocolTemplateModalOpen(false)}
          laboratoryId={settingsScope.laboratoryId}
          departmentId={settingsScope.departmentId}
        />
      )}
      {isReportTemplateModalOpen && settingsScope && (
        <EditReportTemplateModal
          open={isReportTemplateModalOpen}
          onClose={() => setIsReportTemplateModalOpen(false)}
          laboratoryId={settingsScope.laboratoryId}
          departmentId={settingsScope.departmentId}
        />
      )}
      {isSelectionConditionsModalOpen && settingsScope && (
        <SelectionConditionsModal
          open={isSelectionConditionsModalOpen}
          onClose={() => setIsSelectionConditionsModalOpen(false)}
          laboratoryId={settingsScope.laboratoryId}
          departmentId={settingsScope.departmentId}
          entityName={settingsScope.entityName}
        />
      )}
    </div>
  );
};

export default LaboratoryManagement;
