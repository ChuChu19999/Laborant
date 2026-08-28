import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDepartmentsByLaboratory, type Department } from '@/entities/Department';
import { useLaboratories, type Laboratory } from '@/entities/Laboratory';
import { useLaboratoryHasResearchMethodsQuery } from '@/entities/ResearchMethod';
import { usePermissionsContext, useScopeAccess } from '@/entities/Role';
import { notify } from '@/shared/lib/notify';
import { updateUrlParams } from '@/shared/lib/routing';
import type { MenuProps } from '@/shared/ui/Menu';

type ViewMode = 'laboratories' | 'departments';

type SettingsScope = {
  laboratoryId: number;
  departmentId?: number;
  entityName?: string;
};

/** Оркестрация экрана управления лабораториями: URL, данные, модалки, навигация. */
export const useLaboratoryManagement = (onBack: () => void) => {
  const { isAdmin, permissionsData } = usePermissionsContext();
  const canManageStructure = isAdmin || permissionsData.is_admin;
  const { canAccessFeature, canAccessLaboratory } = useScopeAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isUrlStateReadyRef = useRef(false);
  const lastHydratedUrlKeyRef = useRef<string | null>(null);
  const previousSearchRef = useRef<string>(location.search);
  const isClearingRef = useRef(false);
  const autoNavigateLabIdRef = useRef<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('laboratories');
  const [selectedLaboratory, setSelectedLaboratory] = useState<Laboratory | null>(null);
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

  const {
    data: laboratoriesData,
    isLoading: isLaboratoriesLoading,
    isError: isLaboratoriesError,
    refetch: refetchLaboratories,
  } = useLaboratories();

  const laboratories = useMemo(
    () => (laboratoriesData?.items ?? []).filter((lab: Laboratory) => !lab.deleted_at),
    [laboratoriesData]
  );

  const {
    data: departmentsData,
    isLoading: isDepartmentsLoading,
    isError: isDepartmentsError,
    refetch: refetchDepartments,
  } = useDepartmentsByLaboratory(
    selectedLaboratory?.id,
    viewMode === 'departments' && !!selectedLaboratory?.id
  );

  const departments = useMemo(
    () => (departmentsData ?? []).filter((dept: Department) => !dept.deleted_at),
    [departmentsData]
  );

  const isLoading = isLaboratoriesLoading || (viewMode === 'departments' && isDepartmentsLoading);

  const shouldProbeLaboratoryMethods =
    viewMode === 'departments' &&
    selectedLaboratory?.id != null &&
    departments.length === 0 &&
    !isLoading;

  const { data: laboratoryMethodsProbe, isError: isLaboratoryMethodsProbeError } =
    useLaboratoryHasResearchMethodsQuery(selectedLaboratory?.id, shouldProbeLaboratoryMethods);

  useEffect(() => {
    if (isLaboratoriesError) {
      notify.error('Не удалось загрузить лаборатории');
    }
  }, [isLaboratoriesError]);

  useEffect(() => {
    if (isDepartmentsError) {
      notify.error('Не удалось загрузить подразделения');
    }
  }, [isDepartmentsError]);

  useEffect(() => {
    if (isLaboratoryMethodsProbeError) {
      notify.error('Не удалось проверить наличие методов исследования');
    }
  }, [isLaboratoryMethodsProbeError]);

  useEffect(() => {
    if (!shouldProbeLaboratoryMethods || selectedLaboratory?.id == null) {
      autoNavigateLabIdRef.current = null;
      return;
    }
    if (!laboratoryMethodsProbe || laboratoryMethodsProbe.total <= 0) {
      return;
    }
    if (autoNavigateLabIdRef.current === selectedLaboratory.id) {
      return;
    }
    autoNavigateLabIdRef.current = selectedLaboratory.id;
    void navigate(`/admin/laboratory/${selectedLaboratory.id}`);
  }, [shouldProbeLaboratoryMethods, laboratoryMethodsProbe, selectedLaboratory, navigate]);

  useLayoutEffect(() => {
    if (laboratories.length === 0) {
      return;
    }

    const urlViewMode = searchParams.get('viewMode');
    const urlLaboratoryId = searchParams.get('laboratoryId');
    const hydrationKey = `${urlViewMode ?? ''}:${urlLaboratoryId ?? ''}`;

    if (urlViewMode === 'departments' && urlLaboratoryId) {
      const laboratoryId = parseInt(urlLaboratoryId, 10);
      if (!isNaN(laboratoryId) && canAccessLaboratory(laboratoryId)) {
        const lab = laboratories.find(l => l.id === laboratoryId);
        if (lab) {
          setSelectedLaboratory(lab);
          setViewMode('departments');
          lastHydratedUrlKeyRef.current = hydrationKey;
          isUrlStateReadyRef.current = true;
          return;
        }
      }
    }

    if (lastHydratedUrlKeyRef.current !== hydrationKey) {
      if (!urlViewMode && !urlLaboratoryId && !isClearingRef.current) {
        setViewMode('laboratories');
        setSelectedLaboratory(null);
      }
      lastHydratedUrlKeyRef.current = hydrationKey;
    }

    isUrlStateReadyRef.current = true;
  }, [laboratories, searchParams, canAccessLaboratory]);

  useEffect(() => {
    const currentSearch = location.search;
    const wasCleared = previousSearchRef.current !== '' && currentSearch === '';

    if (wasCleared) {
      isClearingRef.current = true;
      setViewMode('laboratories');
      setSelectedLaboratory(null);
      setTimeout(() => {
        isClearingRef.current = false;
      }, 100);
      previousSearchRef.current = currentSearch;
      return;
    }

    previousSearchRef.current = currentSearch;
  }, [location.search]);

  useEffect(() => {
    if (!isUrlStateReadyRef.current || isClearingRef.current) {
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

  const handleLaboratoryClick = (laboratory: Laboratory) => {
    if (!laboratory.id) return;
    setSelectedLaboratory(laboratory);
    setViewMode('departments');
  };

  const handleDepartmentClick = (department: Department) => {
    if (selectedLaboratory && department.id) {
      void navigate(`/admin/laboratory/${selectedLaboratory.id}/department/${department.id}`);
    }
  };

  const handleBack = () => {
    if (viewMode === 'departments') {
      setViewMode('laboratories');
      setSelectedLaboratory(null);
      void refetchLaboratories();
      const newParams = updateUrlParams(searchParams, {
        viewMode: undefined,
        laboratoryId: undefined,
      });
      setSearchParams(newParams, { replace: true });
    } else if (onBack) {
      onBack();
    }
  };

  const handleEdit = (item: Laboratory | Department, e: MouseEvent) => {
    e.stopPropagation();
    setSelectedItem(item);
    if (viewMode === 'laboratories') {
      setIsEditModalOpen(true);
    } else {
      setIsEditDeptModalOpen(true);
    }
  };

  const handleDeleteClick = (item: Laboratory | Department, e: MouseEvent) => {
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
        label: 'Шаблоны протоколов',
        onClick: () => {
          openSettingsForScope(scope);
          setIsProtocolTemplateModalOpen(true);
        },
      },
      {
        key: 'report-template',
        label: 'Шаблоны отчетов',
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
    void refetchLaboratories();
    if (viewMode === 'departments' && selectedLaboratory) {
      void refetchDepartments();
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

  const navigateToLaboratoryMethods = () => {
    if (selectedLaboratory && selectedLaboratory.id) {
      void navigate(`/admin/laboratory/${selectedLaboratory.id}`);
    }
  };

  return {
    canManageStructure,
    canAccessFeature,
    viewMode,
    selectedLaboratory,
    selectedItem,
    settingsScope,
    laboratories,
    departments,
    isLoading,
    breadcrumbs,
    isCreateModalOpen,
    isEditModalOpen,
    isDeleteModalOpen,
    isCreateDeptModalOpen,
    isEditDeptModalOpen,
    isDeleteDeptModalOpen,
    isProtocolTemplateModalOpen,
    isReportTemplateModalOpen,
    isSelectionConditionsModalOpen,
    openCreateModal: () => setIsCreateModalOpen(true),
    openCreateDeptModal: () => setIsCreateDeptModalOpen(true),
    closeProtocolTemplateModal: () => setIsProtocolTemplateModalOpen(false),
    closeReportTemplateModal: () => setIsReportTemplateModalOpen(false),
    closeSelectionConditionsModal: () => setIsSelectionConditionsModalOpen(false),
    handleLaboratoryClick,
    handleDepartmentClick,
    handleBack,
    handleEdit,
    handleDeleteClick,
    handleModalClose,
    buildSettingsMenuItems,
    handleSuccess,
    navigateToLaboratoryMethods,
    onBack,
  };
};
