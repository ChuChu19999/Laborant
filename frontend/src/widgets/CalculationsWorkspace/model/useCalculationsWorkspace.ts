import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  buildAvailableMethodsFromResearchMethod,
  buildCalculationFormPrefill,
  type CalculationResult,
  useCalculation,
  useMethodologyChoice,
} from '@/entities/Calculation';
import { useDepartmentsByLaboratory } from '@/entities/Department';
import { useLaboratory } from '@/entities/Laboratory';
import {
  getFirstGroupMethodId,
  sortGroupMethods,
  useAvailableResearchMethods,
  useResearchMethod,
  type ResearchMethod,
  type ResearchMethodGroup,
} from '@/entities/ResearchMethod';
import { useCan } from '@/entities/Role';
import { useSample } from '@/entities/Sample';
import { extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';
import { parseSearchParamInt } from '@/shared/lib/routing';
import type { AvailableMethod, CalculationsWorkspaceLastCalculationResult } from './types';
import type { Dayjs } from 'dayjs';

export const useCalculationsWorkspace = () => {
  const { laboratoryId, departmentId, sampleId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
    sampleId?: string;
  }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const labId = laboratoryId
    ? parseInt(laboratoryId, 10)
    : parseSearchParamInt(searchParams.get('laboratory_id'));
  const deptId = departmentId
    ? parseInt(departmentId, 10)
    : parseSearchParamInt(searchParams.get('department_id'));

  const canExecuteCalculations = useCan('calculations', 'execute', labId, deptId);
  const canCreateCalculation = useCan('calculations', 'create', labId, deptId);
  const canUpdateCalculation = useCan('calculations', 'update', labId, deptId);

  const [scopeError, setScopeError] = useState<string | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [methodIncludeDeleted, setMethodIncludeDeleted] = useState(false);
  const [lastCalculationResult, setLastCalculationResult] = useState<
    Record<number, CalculationsWorkspaceLastCalculationResult>
  >({});
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [methodologyChoiceModalOpen, setMethodologyChoiceModalOpen] = useState(false);
  const [editMethodologyVersion, setEditMethodologyVersion] = useState<'stored' | 'current' | null>(
    null
  );
  const [editBootstrapDone, setEditBootstrapDone] = useState(false);
  const [createBootstrapDone, setCreateBootstrapDone] = useState(false);

  const sampleIdNum = sampleId
    ? parseInt(sampleId, 10)
    : parseSearchParamInt(searchParams.get('sampleId'));

  const editCalculationIdRaw = searchParams.get('editCalculationId');
  const editCalculationId =
    editCalculationIdRaw !== null && editCalculationIdRaw !== ''
      ? parseInt(editCalculationIdRaw, 10)
      : undefined;
  const isEditMode = typeof editCalculationId === 'number' && !Number.isNaN(editCalculationId);

  const { data: sample, isLoading: isLoadingSample } = useSample(
    sampleIdNum ?? null,
    sampleIdNum != null
  );

  const { data: laboratory } = useLaboratory(labId, labId != null);

  const { data: departments } = useDepartmentsByLaboratory(labId, labId != null);

  const {
    data: editCalculation,
    isLoading: isLoadingEditCalculation,
    error: editCalculationError,
  } = useCalculation(editCalculationId, isEditMode);

  const {
    data: methodologyChoice,
    isLoading: isLoadingMethodologyChoice,
    error: methodologyChoiceError,
  } = useMethodologyChoice(editCalculationId, isEditMode && editCalculation != null);

  const availableParams = useMemo(
    () =>
      labId && sampleIdNum
        ? {
            laboratory_id: labId,
            department_id: deptId,
            sample_id: sampleIdNum,
          }
        : undefined,
    [labId, deptId, sampleIdNum]
  );

  const {
    data: availableMethodsResponse,
    isLoading: isLoadingAvailableMethods,
    error: availableMethodsError,
    refetch: refetchAvailableMethods,
  } = useAvailableResearchMethods(availableParams, !isEditMode && availableParams != null);

  const {
    data: currentMethodData,
    isLoading: isLoadingMethodDetail,
    error: methodDetailError,
  } = useResearchMethod(selectedMethodId, selectedMethodId != null, methodIncludeDeleted);

  const currentMethod = currentMethodData ?? null;

  const availableMethods = useMemo((): AvailableMethod[] => {
    if (!isEditMode) {
      return availableMethodsResponse?.methods ?? [];
    }
    if (currentMethod) {
      return buildAvailableMethodsFromResearchMethod(currentMethod);
    }
    return [];
  }, [isEditMode, availableMethodsResponse, currentMethod]);

  useEffect(() => {
    if (!isEditMode) {
      setMethodologyChoiceModalOpen(false);
      setEditMethodologyVersion(null);
      setEditBootstrapDone(false);
    } else {
      setCreateBootstrapDone(false);
    }
  }, [isEditMode]);

  const handleMethodClick = (methodId: number) => {
    setSelectedMethodId(methodId);
    setMethodIncludeDeleted(false);
  };

  const handleChooseStoredMethodology = () => {
    if (!methodologyChoice) {
      return;
    }
    setMethodologyChoiceModalOpen(false);
    setEditMethodologyVersion('stored');
    setSelectedMethodId(methodologyChoice.stored_method_id);
    setMethodIncludeDeleted(true);
    setLastCalculationResult({});
  };

  const handleChooseCurrentMethodology = (methodId: number) => {
    setMethodologyChoiceModalOpen(false);
    setEditMethodologyVersion('current');
    setSelectedMethodId(methodId);
    setMethodIncludeDeleted(false);
    setLastCalculationResult({});
  };

  const handleMethodologyChoiceCancel = () => {
    setMethodologyChoiceModalOpen(false);
    if (labId && deptId !== undefined) {
      void navigate(`/samples/laboratory/${labId}/department/${deptId}`);
    } else if (labId) {
      void navigate(`/samples/laboratory/${labId}`);
    } else {
      void navigate('/samples');
    }
  };

  useEffect(() => {
    if (!isEditMode) {
      setScopeError(null);
      return;
    }
    if (!labId || !sampleIdNum || !editCalculation) {
      return;
    }

    if (editCalculation.sample_id !== sampleIdNum) {
      setScopeError('Расчёт не относится к выбранной пробе');
      return;
    }
    if (editCalculation.laboratory_id !== labId) {
      setScopeError('Расчёт не относится к выбранной лаборатории');
      return;
    }
    if (
      deptId !== undefined &&
      editCalculation.department_id != null &&
      editCalculation.department_id !== deptId
    ) {
      setScopeError('Расчёт не относится к выбранному подразделению');
      return;
    }

    setScopeError(null);
  }, [isEditMode, labId, sampleIdNum, deptId, editCalculation]);

  useEffect(() => {
    if (!isEditMode || !editCalculation || !methodologyChoice || editBootstrapDone || scopeError) {
      return;
    }

    setLastCalculationResult({});

    if (methodologyChoice.methodology_changed) {
      setMethodologyChoiceModalOpen(true);
      setEditMethodologyVersion(null);
      setSelectedMethodId(null);
      setMethodIncludeDeleted(false);
      setEditBootstrapDone(true);
      return;
    }

    setEditMethodologyVersion('stored');
    setSelectedMethodId(editCalculation.research_method_id);
    setMethodIncludeDeleted(methodologyChoice.stored_method_deleted);
    setEditBootstrapDone(true);
  }, [isEditMode, editCalculation, methodologyChoice, editBootstrapDone, scopeError]);

  useEffect(() => {
    if (isEditMode || !availableMethodsResponse || createBootstrapDone) {
      return;
    }

    const methods = availableMethodsResponse.methods || [];
    if (methods.length > 0) {
      const firstMethod = methods[0];
      if (firstMethod?.is_group && firstMethod.methods && firstMethod.methods.length > 0) {
        const firstGroupMethodId = getFirstGroupMethodId(firstMethod.methods);
        if (firstGroupMethodId != null) {
          setSelectedMethodId(firstGroupMethodId);
          setMethodIncludeDeleted(false);
        }
      } else if (firstMethod && !firstMethod.is_group && typeof firstMethod.id === 'number') {
        setSelectedMethodId(firstMethod.id);
        setMethodIncludeDeleted(false);
      }
    }
    setCreateBootstrapDone(true);
  }, [isEditMode, availableMethodsResponse, createBootstrapDone]);

  useEffect(() => {
    setCreateBootstrapDone(false);
  }, [labId, deptId, sampleIdNum]);

  useEffect(() => {
    setEditBootstrapDone(false);
  }, [editCalculationId]);

  useEffect(() => {
    if (!methodDetailError || selectedMethodId == null) {
      return;
    }

    const message = extractErrorMessage(
      methodDetailError,
      'Не удалось загрузить метод исследования'
    );

    if (isEditMode && editMethodologyVersion != null && methodologyChoice?.methodology_changed) {
      notify.error(message);
      setSelectedMethodId(null);
      setEditMethodologyVersion(null);
      setMethodologyChoiceModalOpen(true);
      return;
    }

    if (isEditMode) {
      setScopeError(message);
      return;
    }

    notify.error(message);
  }, [
    methodDetailError,
    selectedMethodId,
    isEditMode,
    editMethodologyVersion,
    methodologyChoice?.methodology_changed,
  ]);

  const calculationFormPrefill = useMemo(() => {
    if (!isEditMode || !editCalculation || !currentMethod || !editMethodologyVersion) {
      return null;
    }
    if (
      editCalculation.research_method_id !== currentMethod.id &&
      editMethodologyVersion !== 'current'
    ) {
      return null;
    }
    return {
      methodId: currentMethod.id,
      ...buildCalculationFormPrefill(currentMethod, editCalculation),
    };
  }, [isEditMode, editCalculation, currentMethod, editMethodologyVersion]);

  const handleCalculate = (
    result: CalculationResult,
    inputData: Record<string, unknown>,
    laboratoryActivityDate: Dayjs | null
  ) => {
    if (!currentMethod) {
      return;
    }

    setLastCalculationResult(prev => ({
      ...prev,
      [currentMethod.id]: {
        input_data: inputData,
        result: result.result || '',
        result_display: result.result_display,
        measurement_error: result.measurement_error,
        unit: result.unit,
        convergence: result.convergence,
        laboratory_activity_date: laboratoryActivityDate,
        equipment_data:
          isEditMode && typeof editCalculationId === 'number'
            ? (prev[currentMethod.id]?.equipment_data ??
              editCalculation?.equipment_data ??
              currentMethod.equipment_data_default)
            : currentMethod.equipment_data_default,
      },
    }));
  };

  const handleLaboratoryActivityDateChange = (date: Dayjs | null) => {
    setLastCalculationResult(prev => {
      if (!currentMethod) {
        return prev;
      }
      const existing = prev[currentMethod.id];
      if (!existing) {
        return prev;
      }
      return {
        ...prev,
        [currentMethod.id]: {
          ...existing,
          laboratory_activity_date: date,
        },
      };
    });
  };

  const handleOpenSaveModal = () => {
    if (!currentMethod) {
      notify.warning('Метод не выбран');
      return;
    }

    const calculationData = lastCalculationResult[currentMethod.id];
    if (!calculationData) {
      notify.warning('Нет результатов для сохранения');
      return;
    }

    setIsSaveModalOpen(true);
  };

  const handleSaveSuccess = async () => {
    setIsSaveModalOpen(false);

    if (isEditMode && labId) {
      if (deptId !== undefined) {
        void navigate(`/samples/laboratory/${labId}/department/${deptId}`);
      } else {
        void navigate(`/samples/laboratory/${labId}`);
      }
      return;
    }

    if (currentMethod) {
      setLastCalculationResult(prev => {
        const newResult = { ...prev };
        delete newResult[currentMethod.id];
        return newResult;
      });
    }

    if (labId && sampleIdNum) {
      try {
        const response = (await refetchAvailableMethods()).data;
        if (!response) {
          notify.error('Не удалось обновить список методов');
          return;
        }

        if (currentMethod) {
          const isCurrentMethodAvailable = response.methods?.some(method =>
            method.is_group
              ? method.methods?.some(m => m.id === currentMethod.id)
              : method.id === currentMethod.id
          );

          if (!isCurrentMethodAvailable && response.methods && response.methods.length > 0) {
            const firstMethod = response.methods[0];
            if (!firstMethod) {
              return;
            }
            if (firstMethod.is_group && firstMethod.methods && firstMethod.methods.length > 0) {
              const firstGroupMethodId = getFirstGroupMethodId(firstMethod.methods);
              if (firstGroupMethodId != null) {
                setSelectedMethodId(firstGroupMethodId);
                setMethodIncludeDeleted(false);
              }
            } else if (!firstMethod.is_group && typeof firstMethod.id === 'number') {
              setSelectedMethodId(firstMethod.id);
              setMethodIncludeDeleted(false);
            }
          }
        }
      } catch (error) {
        notify.error(extractErrorMessage(error, 'Не удалось обновить список методов'));
      }
    }
  };

  const handleBack = () => {
    if (labId && deptId) {
      void navigate(`/samples/laboratory/${labId}/department/${deptId}`);
    } else if (labId) {
      void navigate(`/samples/laboratory/${labId}`);
    } else {
      void navigate('/samples');
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
        label: 'Поступления проб',
        onClick: () => {
          void navigate('/samples');
        },
      },
    ];

    if (laboratory) {
      items.push({
        label: laboratory.name,
        onClick: deptId
          ? () => {
              void navigate(`/samples/laboratory/${labId}`);
            }
          : undefined,
      });
    }

    if (deptId && departments) {
      const department = departments.find(d => d.id === deptId);
      if (department) {
        items.push({
          label: department.name,
          onClick: () => {
            void navigate(`/samples/laboratory/${labId}/department/${deptId}`);
          },
        });
      }
    }

    if (sample) {
      items.push({ label: `Проба № ${sample.registration_number}` });
    } else {
      items.push({ label: 'Расчёты' });
    }

    return items;
  }, [deptId, departments, labId, laboratory, navigate, sample]);

  const methods = useMemo(() => {
    const result: ResearchMethod[] = [];
    availableMethods.forEach(method => {
      if (method.is_group && method.methods) {
        method.methods.forEach(m => {
          const groupMeta =
            method.group_id != null ? [{ id: method.group_id, name: method.name }] : [];
          result.push({
            id: m.id,
            name: m.name,
            sample_type: [],
            formula: '',
            measurement_error: { type: 'fixed', value: '' },
            unit: m.unit || '',
            measurement_method: '',
            nd_code: '',
            nd_name: '',
            input_data: m.input_data || { fields: [] },
            intermediate_data: m.intermediate_data || { fields: [] },
            convergence_conditions: { formulas: [] },
            rounding_type: 'decimal',
            rounding_decimal: 0,
            is_group_member: true,
            groups: groupMeta,
            created_at: '',
            updated_at: '',
          });
        });
      } else if (!method.is_group && typeof method.id === 'number') {
        result.push({
          id: method.id,
          name: method.name,
          sample_type: [],
          formula: '',
          measurement_error: { type: 'fixed', value: '' },
          unit: method.unit || '',
          measurement_method: '',
          nd_code: '',
          nd_name: '',
          input_data: method.input_data || { fields: [] },
          intermediate_data: method.intermediate_data || { fields: [] },
          convergence_conditions: { formulas: [] },
          rounding_type: 'decimal',
          rounding_decimal: 0,
          is_group_member: false,
          created_at: '',
          updated_at: '',
        });
      }
    });
    return result;
  }, [availableMethods]);

  const groups = useMemo((): ResearchMethodGroup[] => {
    return availableMethods
      .filter(m => m.is_group)
      .map(m => ({
        id: typeof m.group_id === 'number' ? m.group_id : 0,
        name: m.name,
        methods: sortGroupMethods(
          (m.methods || []).map(method => ({
            id: method.id,
            name: method.name,
            sort_order: method.sort_order,
          }))
        ),
        sort_order: m.sort_order || 0,
        created_at: '',
        updated_at: '',
        deleted_at: undefined,
      }));
  }, [availableMethods]);

  const queryErrorMessage = useMemo(() => {
    if (scopeError) {
      return scopeError;
    }
    if (editCalculationError) {
      return extractErrorMessage(editCalculationError, 'Не удалось загрузить расчёт');
    }
    if (methodologyChoiceError) {
      return extractErrorMessage(methodologyChoiceError, 'Не удалось загрузить варианты методик');
    }
    if (availableMethodsError) {
      return extractErrorMessage(availableMethodsError, 'Не удалось загрузить методы исследования');
    }
    return null;
  }, [scopeError, editCalculationError, methodologyChoiceError, availableMethodsError]);

  const isWaitingCreateBootstrap =
    !isEditMode && !createBootstrapDone && availableMethodsResponse != null;
  const isWaitingEditBootstrap =
    isEditMode &&
    !editBootstrapDone &&
    !scopeError &&
    editCalculation != null &&
    methodologyChoice != null;

  const isLoadingMethod =
    (selectedMethodId != null && isLoadingMethodDetail) ||
    isWaitingCreateBootstrap ||
    isWaitingEditBootstrap;

  const isLoadingMethodsList =
    (!isEditMode && (isLoadingAvailableMethods || isWaitingCreateBootstrap)) ||
    (isEditMode && (isLoadingEditCalculation || isWaitingEditBootstrap));

  const isLoading =
    isLoadingMethod ||
    (isEditMode &&
      (isLoadingEditCalculation || (editCalculation != null && isLoadingMethodologyChoice))) ||
    (!isEditMode && isLoadingAvailableMethods);

  const currentMethodGroup = useMemo(() => {
    if (!currentMethod) {
      return null;
    }
    return groups.find(group => group.methods.some(gm => gm.id === currentMethod.id));
  }, [groups, currentMethod]);

  const groupMethods = useMemo(() => {
    if (!currentMethodGroup) {
      return [];
    }
    return currentMethodGroup.methods;
  }, [currentMethodGroup]);

  const shouldShowGroupSelector = useMemo(() => {
    if (!currentMethodGroup) {
      return false;
    }

    const isExcludedMethod = groupMethods.some(
      method =>
        method.name === 'Конденсат' ||
        method.name === 'Нефть' ||
        method.name === 'Фракционный состав (конденсат)' ||
        method.name === 'Фракционный состав (нефть)'
    );

    if (!isExcludedMethod) {
      return groupMethods.length > 0;
    }

    return groupMethods.length > 1;
  }, [currentMethodGroup, groupMethods]);

  const canSaveCalculation = isEditMode ? canUpdateCalculation : canCreateCalculation;

  const savedCalculationResult = currentMethod
    ? lastCalculationResult[currentMethod.id]
    : undefined;

  const title = sample
    ? isEditMode
      ? `Редактирование расчёта — проба № ${sample.registration_number}`
      : `Проба № ${sample.registration_number}`
    : 'Расчёты';

  return {
    labId,
    deptId,
    sampleIdNum,
    editCalculationId,
    isEditMode,
    isLoadingSample,
    isLoading,
    isLoadingMethodsList,
    queryErrorMessage,
    breadcrumbs,
    title,
    handleBack,
    availableMethods,
    selectedMethodId,
    currentMethod,
    methodologyChoiceModalOpen,
    methodologyChoice,
    methods,
    groups,
    calculationFormPrefill,
    lastCalculationResult,
    savedCalculationResult,
    canExecuteCalculations,
    canSaveCalculation,
    shouldShowGroupSelector,
    groupMethods,
    handleMethodClick,
    handleCalculate,
    handleLaboratoryActivityDateChange,
    handleOpenSaveModal,
    handleSaveSuccess,
    handleChooseStoredMethodology,
    handleChooseCurrentMethodology,
    handleMethodologyChoiceCancel,
    isSaveModalOpen,
    setIsSaveModalOpen,
    editMethodologyVersion,
    editCalculation,
  };
};
