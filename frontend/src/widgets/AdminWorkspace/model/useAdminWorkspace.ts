import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  buildCalculationFormPrefill,
  useCalculationQueries,
  type CalculationResult,
} from '@/entities/Calculation';
import { useDepartmentsByLaboratory } from '@/entities/Department';
import { useLaboratory } from '@/entities/Laboratory';
import {
  getActiveGroupMethodsForSelect,
  getFirstGroupMethodId,
  sortGroupMethods,
  useResearchMethods,
  useBatchUpdateSortOrder,
  useResearchMethodsQueryStore,
  type ResearchMethod,
  type ResearchMethodGroup,
} from '@/entities/ResearchMethod';
import { useSampleQueries } from '@/entities/Sample';
import { extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';
import { useAdminWorkspaceMethodSelection } from './useAdminWorkspaceMethodSelection';
import type { DeleteResearchMethodTarget } from '@/features/DeleteResearchMethodModal';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { Dayjs } from 'dayjs';

export type AdminWorkspaceListItem =
  | { type: 'method'; id: number; data: ResearchMethod }
  | { type: 'group'; id: number; data: ResearchMethodGroup };

export type AdminWorkspaceCalculationResult = {
  input_data: Record<string, unknown>;
  result: string;
  result_display?: string;
  measurement_error?: string;
  unit?: string;
  convergence?: string;
  laboratory_activity_date: Dayjs | null;
  equipment_data?: number[];
};

export const useAdminWorkspace = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const navigate = useNavigate();
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [showAddButton] = useState(true);
  const [isCreateResearchMethodModalOpen, setIsCreateResearchMethodModalOpen] = useState(false);
  const [editResearchMethodId, setEditResearchMethodId] = useState<number | undefined>(undefined);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [isSaveCalculationModalOpen, setIsSaveCalculationModalOpen] = useState(false);
  const [lastCalculationResult, setLastCalculationResult] = useState<
    Record<number, AdminWorkspaceCalculationResult>
  >({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteResearchMethodTarget | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [isLoadingRegistrationData, setIsLoadingRegistrationData] = useState(false);
  // ref: регистрация колбэка из CalculationPanel не должна вызывать setState (иначе цикл рендеров)
  const dataLoadedCallbackRef = useRef<
    | ((data: {
        initialValues: Record<string, string>;
        laboratoryActivityDate: Dayjs | null;
      }) => void)
    | null
  >(null);

  const labId = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const deptId = departmentId ? parseInt(departmentId, 10) : undefined;

  const {
    setResearchMethodsSorting,
    setResearchMethodsLaboratoryId,
    setResearchMethodsDepartmentId,
    setResearchMethodsPageSize,
  } = useResearchMethodsQueryStore();

  const researchMethods = useResearchMethods(labId, deptId);
  const batchUpdateSortOrderMutation = useBatchUpdateSortOrder();
  const { fetchSamplesByRegistrationNumber } = useSampleQueries();
  const { fetchCalculationsBySampleIds } = useCalculationQueries();

  const { data: laboratory } = useLaboratory(labId, !!labId);
  const { data: departments } = useDepartmentsByLaboratory(labId, !!labId);

  const department = useMemo(() => {
    if (!deptId || !departments) return null;
    return departments.find(dept => dept.id === deptId) || null;
  }, [deptId, departments]);

  useEffect(() => {
    if (labId) {
      setResearchMethodsLaboratoryId(labId);
    }
    setResearchMethodsDepartmentId(deptId);
    setResearchMethodsPageSize(100);
    setResearchMethodsSorting({ sort_by: 'sort_order', sort_order: 'asc' });
  }, [
    labId,
    deptId,
    setResearchMethodsLaboratoryId,
    setResearchMethodsDepartmentId,
    setResearchMethodsPageSize,
    setResearchMethodsSorting,
  ]);

  const methods = useMemo(() => {
    return researchMethods.methods.data.filter(method => !method.deleted_at);
  }, [researchMethods.methods.data]);

  const groups = useMemo(() => {
    return researchMethods.groups.data.filter(group => !group.deleted_at);
  }, [researchMethods.groups.data]);

  const displayItems = useMemo(() => {
    const methodIdsInGroups = new Set<number>();
    groups.forEach(group => {
      group.methods.forEach(method => {
        methodIdsInGroups.add(method.id);
      });
    });

    const items: AdminWorkspaceListItem[] = [];
    const standaloneMethods = methods.filter(method => !methodIdsInGroups.has(method.id));

    standaloneMethods.forEach(method => {
      items.push({ type: 'method', id: method.id, data: method });
    });

    groups.forEach(group => {
      const groupMethods = methods.filter(method => group.methods.some(gm => gm.id === method.id));
      if (groupMethods.length > 0) {
        items.push({ type: 'group', id: group.id, data: group });
      }
    });

    items.sort((a, b) => {
      const aOrder = a.data.sort_order ?? null;
      const bOrder = b.data.sort_order ?? null;
      if (aOrder === null && bOrder === null) {
        return 0;
      }
      if (aOrder === null) {
        return 1;
      }
      if (bOrder === null) {
        return -1;
      }
      return aOrder - bOrder;
    });

    return items;
  }, [methods, groups]);

  useAdminWorkspaceMethodSelection(
    labId,
    deptId,
    methods,
    groups,
    displayItems,
    selectedMethodId,
    setSelectedMethodId
  );

  useEffect(() => {
    if (selectedMethodId) {
      setRegistrationNumber('');
    }
  }, [selectedMethodId]);

  const handleBack = () => {
    if (laboratoryId && departmentId) {
      void navigate(`/laboratory-management?viewMode=departments&laboratoryId=${laboratoryId}`);
      return;
    }
    void navigate('/laboratory-management');
  };

  const breadcrumbs = useMemo((): { label: string; onClick?: () => void }[] => {
    const items: { label: string; onClick?: () => void }[] = [
      { label: 'Главная', onClick: () => void navigate('/') },
      { label: 'Управление лабораториями', onClick: () => void navigate('/laboratory-management') },
    ];

    if (laboratory) {
      items.push(
        departmentId
          ? {
              label: laboratory.name,
              onClick: () => {
                if (labId != null && deptId != null) {
                  void navigate(
                    `/laboratory-management?viewMode=departments&laboratoryId=${labId}`
                  );
                  return;
                }
                void navigate('/laboratory-management');
              },
            }
          : { label: laboratory.name }
      );
    }

    if (departmentId) {
      items.push({ label: department ? department.name : 'Загрузка...' });
    }

    return items;
  }, [department, departmentId, deptId, labId, laboratory, navigate]);

  const handleMethodClick = (itemId: number, itemType: 'method' | 'group') => {
    if (itemType === 'method') {
      setSelectedMethodId(itemId);
      return;
    }

    const group = groups.find(g => g.id === itemId);
    if (group && group.methods.length > 0) {
      const activeGroupMethods = getActiveGroupMethodsForSelect(group.methods, methods);
      const firstGroupMethodId = getFirstGroupMethodId(activeGroupMethods);
      if (firstGroupMethodId != null) {
        setSelectedMethodId(firstGroupMethodId);
      }
    }
  };

  const handleMethodDelete = (itemId: number, itemType: 'method' | 'group') => {
    const item = displayItems.find(i => i.id === itemId && i.type === itemType);
    if (!item) return;

    setDeleteTarget({
      type: itemType,
      id: itemId,
      name: item.data.name,
    });
    setIsDeleteModalOpen(true);
  };

  const handleDeleteModalClose = () => {
    setIsDeleteModalOpen(false);
    setDeleteTarget(null);
  };

  const handleDeleteSuccess = () => {
    setIsDeleteModalOpen(false);
    setDeleteTarget(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const parseId = (id: string | number): { type: 'method' | 'group'; id: number } | null => {
      const idStr = String(id);
      if (idStr.includes('-')) {
        const [type, idPart] = idStr.split('-');
        if (idPart === undefined) {
          return null;
        }
        const numId = parseInt(idPart, 10);
        if (!isNaN(numId) && (type === 'method' || type === 'group')) {
          return { type, id: numId };
        }
      }
      return null;
    };

    const activeParsed = parseId(active.id);
    const overParsed = parseId(over.id);

    if (!activeParsed || !overParsed) {
      return;
    }

    const oldIndex = displayItems.findIndex(
      item => item.id === activeParsed.id && item.type === activeParsed.type
    );
    const newIndex = displayItems.findIndex(
      item => item.id === overParsed.id && item.type === overParsed.type
    );

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
      return;
    }

    try {
      const item = displayItems[oldIndex];
      const targetItem = displayItems[newIndex];
      if (!item || !targetItem) {
        return;
      }
      const itemsToUpdate: { type: 'method' | 'group'; id: number; sort_order: number }[] = [];

      if (oldIndex < newIndex) {
        const targetSortOrder = targetItem.data.sort_order;
        if (targetSortOrder === null || targetSortOrder === undefined) {
          return;
        }

        for (let i = oldIndex + 1; i <= newIndex; i++) {
          const currentItem = displayItems[i];
          const prevItem = displayItems[i - 1];
          if (!currentItem || !prevItem) {
            continue;
          }
          const prevSortOrder = prevItem.data.sort_order;
          if (prevSortOrder !== null && prevSortOrder !== undefined) {
            itemsToUpdate.push({
              type: currentItem.type,
              id: currentItem.data.id,
              sort_order: prevSortOrder,
            });
          }
        }

        itemsToUpdate.push({
          type: item.type,
          id: item.data.id,
          sort_order: targetSortOrder,
        });
      } else {
        const targetSortOrder = targetItem.data.sort_order;
        if (targetSortOrder === null || targetSortOrder === undefined) {
          return;
        }

        for (let i = oldIndex - 1; i >= newIndex; i--) {
          const currentItem = displayItems[i];
          const nextItem = displayItems[i + 1];
          if (!currentItem || !nextItem) {
            continue;
          }
          const nextSortOrder = nextItem.data.sort_order;
          if (nextSortOrder !== null && nextSortOrder !== undefined) {
            itemsToUpdate.push({
              type: currentItem.type,
              id: currentItem.data.id,
              sort_order: nextSortOrder,
            });
          }
        }

        itemsToUpdate.push({
          type: item.type,
          id: item.data.id,
          sort_order: targetSortOrder,
        });
      }

      if (itemsToUpdate.length > 0) {
        await batchUpdateSortOrderMutation.mutateAsync(
          itemsToUpdate.map(update => ({
            id: update.id,
            type: update.type,
            sort_order: update.sort_order,
          }))
        );
      }
    } catch (error) {
      notify.error(extractErrorMessage(error, 'Не удалось обновить порядок сортировки'));
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleAddMethod = () => {
    setIsCreateResearchMethodModalOpen(true);
  };

  const handleResearchMethodModalClose = () => {
    setIsCreateResearchMethodModalOpen(false);
    setEditResearchMethodId(undefined);
  };

  const handleResearchMethodModalSuccess = (payload: ResearchMethod | ResearchMethodGroup) => {
    setIsCreateResearchMethodModalOpen(false);
    setEditResearchMethodId(undefined);
    if ('formula' in payload) {
      setSelectedMethodId(payload.id);
    }
  };

  const handleEditResearchMethod = (methodId: number) => {
    setEditResearchMethodId(methodId);
    setIsCreateResearchMethodModalOpen(true);
  };

  const hasNoMethods = displayItems.length === 0;

  const currentMethod = useMemo(() => {
    return methods.find(method => method.id === selectedMethodId) || null;
  }, [selectedMethodId, methods]);

  const currentMethodGroup = useMemo(() => {
    if (!currentMethod) return null;
    return groups.find(group => group.methods.some(gm => gm.id === currentMethod.id));
  }, [groups, currentMethod]);

  const groupMethods = useMemo(() => {
    if (!currentMethodGroup) return [];
    return sortGroupMethods(
      methods.filter(m => currentMethodGroup.methods.some(gm => gm.id === m.id))
    );
  }, [currentMethodGroup, methods]);

  const shouldShowGroupSelector = useMemo(() => {
    if (!currentMethodGroup || groupMethods.length <= 1) return false;
    return true;
  }, [currentMethodGroup, groupMethods]);

  const handleOpenEquipmentModal = () => {
    if (!currentMethod) {
      notify.warning('Сначала выберите метод исследования');
      return;
    }
    setIsEquipmentModalOpen(true);
  };

  const handleCloseEquipmentModal = () => {
    setIsEquipmentModalOpen(false);
  };

  const handleCalculate = (
    result: CalculationResult,
    inputData: Record<string, unknown>,
    laboratoryActivityDate: Dayjs | null
  ) => {
    if (!currentMethod) return;

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
        equipment_data: currentMethod.equipment_data_default,
      },
    }));
  };

  const handleLaboratoryActivityDateChange = (date: Dayjs | null) => {
    setLastCalculationResult(prev => {
      if (!currentMethod) return prev;
      const existing = prev[currentMethod.id];
      if (!existing) return prev;
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
      return;
    }

    const calculationData = lastCalculationResult[currentMethod.id];
    if (!calculationData) {
      return;
    }

    setIsSaveCalculationModalOpen(true);
  };

  const handleSaveSuccess = () => {
    setIsSaveCalculationModalOpen(false);

    if (currentMethod) {
      setLastCalculationResult(prev => {
        const newResult = { ...prev };
        delete newResult[currentMethod.id];
        return newResult;
      });
    }
  };

  const handleLoadRegistrationData = async () => {
    const dataLoadedCallback = dataLoadedCallbackRef.current;
    if (!dataLoadedCallback) {
      return;
    }
    if (!registrationNumber || !currentMethod) {
      notify.warning('Введите регистрационный номер пробы');
      return;
    }

    setIsLoadingRegistrationData(true);

    try {
      const samplesResponse = await fetchSamplesByRegistrationNumber(
        registrationNumber,
        labId,
        deptId
      );

      if (!samplesResponse.items.length) {
        throw new Error('Проба не найдена');
      }

      const sampleIds = samplesResponse.items.map(sample => sample.id);
      const calculationsBySample = await fetchCalculationsBySampleIds(sampleIds);

      let targetSample = null;
      let targetCalculation = null;

      for (let index = 0; index < samplesResponse.items.length; index++) {
        const sample = samplesResponse.items[index];
        if (!sample) {
          continue;
        }
        const calculations = calculationsBySample[index] ?? [];
        const calculation = calculations.find(calc => calc.research_method_id === currentMethod.id);

        if (calculation) {
          targetSample = sample;
          targetCalculation = calculation;
          break;
        }
      }

      if (!targetSample || !targetCalculation) {
        const allCalculations = calculationsBySample.flat();

        if (allCalculations.length === 0) {
          throw new Error('Для данной пробы не найдено ни одного расчёта');
        }

        const availableMethods = allCalculations.map(calc => calc.research_method_id);
        const methodNames = methods.filter(m => availableMethods.includes(m.id)).map(m => m.name);
        throw new Error(
          `Для данной пробы нет расчётов по методу "${currentMethod.name}". ` +
            `Доступные методы: ${methodNames.join(', ')}`
        );
      }

      const inputData = targetCalculation.input_data;
      let calculationInputFields: string[] = [];

      if (
        currentMethod.name === 'Фракционный состав (конденсат)' ||
        currentMethod.name === 'Фракционный состав (нефть)'
      ) {
        if (inputData._fractional_data) {
          const fractionalData = inputData._fractional_data as {
            card1?: Record<string, unknown>;
            card2?: Record<string, unknown>;
          };
          const card1Fields = Object.keys(fractionalData.card1 || {});
          const card2Fields = Object.keys(fractionalData.card2 || {});
          calculationInputFields = [...new Set([...card1Fields, ...card2Fields])];
        } else {
          calculationInputFields = Object.keys(inputData);
        }
      } else {
        calculationInputFields = Object.keys(inputData);
      }

      const currentMethodFields = currentMethod.input_data.fields.map(field => field.name);
      const uniqueCurrentMethodFields = Array.from(new Set(currentMethodFields));
      const uniqueCalculationInputFields = Array.from(new Set(calculationInputFields));

      const extraFields = uniqueCalculationInputFields.filter(
        field => !uniqueCurrentMethodFields.includes(field) && field !== '_fractional_data'
      );
      if (extraFields.length > 0) {
        throw new Error(
          `Структура метода изменилась. Лишние поля в расчёте: ${extraFields.join(', ')}`
        );
      }

      const prefill = buildCalculationFormPrefill(currentMethod, targetCalculation);

      dataLoadedCallback({
        initialValues: prefill.initialValues,
        laboratoryActivityDate: prefill.laboratoryActivityDate,
      });

      notify.success('Данные успешно загружены');
    } catch (error: unknown) {
      notify.error(
        error instanceof Error ? error.message : 'Не удалось загрузить данные по указанному номеру'
      );
    } finally {
      setIsLoadingRegistrationData(false);
    }
  };

  const handleRegistrationDataLoader = (
    callback: (data: {
      initialValues: Record<string, string>;
      laboratoryActivityDate: Dayjs | null;
    }) => void
  ) => {
    dataLoadedCallbackRef.current = callback;
  };

  const savedCalculationResult =
    currentMethod != null ? lastCalculationResult[currentMethod.id] : undefined;

  const methodsLoading = researchMethods.methods.isLoading || researchMethods.groups.isLoading;

  const laboratoryIdNum = laboratoryId ? parseInt(laboratoryId, 10) : undefined;
  const departmentIdNum = departmentId ? parseInt(departmentId, 10) : undefined;

  return {
    laboratoryId,
    departmentId,
    laboratoryIdNum,
    departmentIdNum,
    labId,
    deptId,
    breadcrumbs,
    handleBack,
    methods,
    groups,
    displayItems,
    selectedMethodId,
    setSelectedMethodId,
    showAddButton,
    activeId,
    methodsLoading,
    hasNoMethods,
    currentMethod,
    groupMethods,
    shouldShowGroupSelector,
    registrationNumber,
    setRegistrationNumber,
    isLoadingRegistrationData,
    lastCalculationResult,
    savedCalculationResult,
    isCreateResearchMethodModalOpen,
    editResearchMethodId,
    isEquipmentModalOpen,
    isSaveCalculationModalOpen,
    setIsSaveCalculationModalOpen,
    isDeleteModalOpen,
    deleteTarget,
    laboratory,
    department,
    handleMethodClick,
    handleMethodDelete,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    handleAddMethod,
    handleResearchMethodModalClose,
    handleResearchMethodModalSuccess,
    handleEditResearchMethod,
    handleOpenEquipmentModal,
    handleCloseEquipmentModal,
    handleCalculate,
    handleLaboratoryActivityDateChange,
    handleOpenSaveModal,
    handleSaveSuccess,
    handleLoadRegistrationData,
    handleRegistrationDataLoader,
    handleDeleteModalClose,
    handleDeleteSuccess,
  };
};
