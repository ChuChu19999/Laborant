import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { SettingOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { ConfirmationModal } from '../../entities/ConfirmationModal';
import RegistrationNumberPicker from '../../entities/RegistrationNumberPicker/ui/RegistrationNumberPicker';
import {
  CreateCalculationModal,
  SaveCalculationModal,
  EquipmentDefaultModal,
} from '../../features/Modals';
import { calculationApi } from '../../shared/api/calculation';
import { laboratoriesApi } from '../../shared/api/laboratories';
import { samplesApi } from '../../shared/api/samples';
import { useScopeAccess } from '../../shared/lib/permissions';
import {
  useResearchMethods,
  useDeleteResearchMethod,
  useDeleteResearchMethodGroup,
  useBatchUpdateSortOrder,
} from '../../shared/model/hooks';
import { useAutoRefetchQuery } from '../../shared/model/lib/useQuery';
import { useQueryStore } from '../../shared/model/stores';
import Button from '../../shared/ui/Button';
import { Select } from '../../shared/ui/FormItems';
import Layout from '../../shared/ui/Layout';
import Tooltip from '../../shared/ui/Tooltip';
import { buildCalculationFormPrefill } from '../../shared/utils/calculationFormPrefill';
import {
  getActiveGroupMethodsForSelect,
  getFirstGroupMethodId,
  sortGroupMethods,
} from '../../shared/utils/researchMethodGroup';
import { CalculationPanel } from '../../widgets/CalculationPanel';
import { MethodsPanel } from '../../widgets/MethodsPanel';
import { NavigationBar } from '../../widgets/NavigationBar';
import { SplitPanel } from '../../widgets/SplitPanel';
import type { CalculationResult } from '../../shared/api/calculation';
import type { Laboratory, Department } from '../../shared/api/laboratories';
import type { ResearchMethod, ResearchMethodGroup } from '../../shared/api/research';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { Dayjs } from 'dayjs';
import './AdminPage.css';

const { Option } = Select;

type ListItem =
  | { type: 'method'; id: number; data: ResearchMethod }
  | { type: 'group'; id: number; data: ResearchMethodGroup };

const AdminPage: React.FC = () => {
  const { laboratoryId, departmentId } = useParams<{
    laboratoryId?: string;
    departmentId?: string;
  }>();
  const navigate = useNavigate();
  const { canAccessFeatureRoute } = useScopeAccess();
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [showAddButton] = useState(true);
  const [isCreateCalculationModalOpen, setIsCreateCalculationModalOpen] = useState(false);
  const [editCalculationMethodId, setEditCalculationMethodId] = useState<number | undefined>(
    undefined
  );
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [isSaveCalculationModalOpen, setIsSaveCalculationModalOpen] = useState(false);
  const [lastCalculationResult, setLastCalculationResult] = useState<
    Record<
      number,
      {
        input_data: Record<string, unknown>;
        result: string;
        result_display?: string;
        measurement_error?: string;
        unit?: string;
        convergence?: string;
        laboratory_activity_date: Dayjs | null;
        equipment_data?: number[];
      }
    >
  >({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    itemId: number | null;
    itemType: 'method' | 'group' | null;
    itemName: string | null;
  }>({
    isOpen: false,
    itemId: null,
    itemType: null,
    itemName: null,
  });
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [isLoadingRegistrationData, setIsLoadingRegistrationData] = useState(false);
  const [dataLoadedCallback, setDataLoadedCallback] = useState<
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
  } = useQueryStore();

  const researchMethods = useResearchMethods(labId, deptId);
  const deleteMethodMutation = useDeleteResearchMethod();
  const deleteGroupMutation = useDeleteResearchMethodGroup();
  const batchUpdateSortOrderMutation = useBatchUpdateSortOrder();

  const { data: laboratory } = useAutoRefetchQuery<Laboratory>(
    ['laboratory', labId],
    () => laboratoriesApi.getLaboratory(labId!),
    {
      enabled: !!labId,
    }
  );

  const { data: departments } = useAutoRefetchQuery<Department[]>(
    ['departments', 'by-laboratory', labId],
    () => laboratoriesApi.getDepartmentsByLaboratory(labId!),
    {
      enabled: !!labId,
    }
  );

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

    const items: ListItem[] = [];
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

  useEffect(() => {
    if (selectedMethodId === null && displayItems.length > 0) {
      const firstItem = displayItems[0];
      if (firstItem.type === 'method') {
        setSelectedMethodId(firstItem.id);
      } else {
        const group = groups.find(g => g.id === firstItem.id);
        if (group && group.methods.length > 0) {
          const activeGroupMethods = getActiveGroupMethodsForSelect(group.methods, methods);
          const firstGroupMethodId = getFirstGroupMethodId(activeGroupMethods);
          if (firstGroupMethodId != null) {
            setSelectedMethodId(firstGroupMethodId);
          }
        }
      }
    }
  }, [displayItems, groups, methods, selectedMethodId]);

  useEffect(() => {
    if (selectedMethodId) {
      setRegistrationNumber('');
    }
  }, [selectedMethodId]);

  const handleBack = () => {
    if (laboratoryId && departmentId) {
      navigate(`/laboratory-management?viewMode=departments&laboratoryId=${laboratoryId}`);
      return;
    }
    navigate('/laboratory-management');
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleBackToLaboratories = () => {
    navigate('/laboratory-management');
  };

  const getBreadcrumbs = (): Array<{ label: string; onClick?: () => void }> => {
    const breadcrumbs: Array<{ label: string; onClick?: () => void }> = [
      { label: 'Главная', onClick: handleBackToHome },
    ];

    breadcrumbs.push({ label: 'Управление лабораториями', onClick: handleBackToLaboratories });

    if (laboratory) {
      const labBreadcrumb = departmentId
        ? { label: laboratory.name, onClick: handleBack }
        : { label: laboratory.name };
      breadcrumbs.push(labBreadcrumb);
    }

    if (departmentId) {
      const departmentName = department ? department.name : 'Загрузка...';
      breadcrumbs.push({ label: departmentName });
    }

    return breadcrumbs;
  };

  const handleMethodClick = (itemId: number, itemType: 'method' | 'group') => {
    if (itemType === 'method') {
      setSelectedMethodId(itemId);
    } else {
      const group = groups.find(g => g.id === itemId);
      if (group && group.methods.length > 0) {
        const activeGroupMethods = getActiveGroupMethodsForSelect(group.methods, methods);
        const firstGroupMethodId = getFirstGroupMethodId(activeGroupMethods);
        if (firstGroupMethodId != null) {
          setSelectedMethodId(firstGroupMethodId);
        }
      }
    }
  };

  const handleMethodDelete = (itemId: number, itemType: 'method' | 'group') => {
    const item = displayItems.find(i => i.id === itemId && i.type === itemType);
    if (!item) return;

    const itemName = item.type === 'method' ? item.data.name : item.data.name;
    setDeleteConfirmation({
      isOpen: true,
      itemId,
      itemType,
      itemName,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation.itemId || !deleteConfirmation.itemType) return;

    try {
      if (deleteConfirmation.itemType === 'method') {
        await deleteMethodMutation.mutateAsync(deleteConfirmation.itemId);
      } else {
        await deleteGroupMutation.mutateAsync(deleteConfirmation.itemId);
      }
      await researchMethods.refetch();
      setDeleteConfirmation({
        isOpen: false,
        itemId: null,
        itemType: null,
        itemName: null,
      });
    } catch (error) {
      console.error('Ошибка при скрытии:', error);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmation({
      isOpen: false,
      itemId: null,
      itemType: null,
      itemName: null,
    });
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

    // Парсим составные ID вида "method-4" или "group-3"
    const parseId = (id: string | number): { type: 'method' | 'group'; id: number } | null => {
      const idStr = String(id);
      if (idStr.includes('-')) {
        const [type, idPart] = idStr.split('-');
        const numId = parseInt(idPart, 10);
        if (!isNaN(numId) && (type === 'method' || type === 'group')) {
          return { type, id: numId };
        }
      }
      return null;
    };

    const activeParsed = parseId(active.id as string);
    const overParsed = parseId(over.id as string);

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
      const itemsToUpdate: Array<{ type: 'method' | 'group'; id: number; sort_order: number }> = [];

      if (oldIndex < newIndex) {
        const targetSortOrder = displayItems[newIndex].data.sort_order;
        if (targetSortOrder === null || targetSortOrder === undefined) {
          return;
        }

        for (let i = oldIndex + 1; i <= newIndex; i++) {
          const currentItem = displayItems[i];
          const prevItem = displayItems[i - 1];
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
        const targetSortOrder = displayItems[newIndex].data.sort_order;
        if (targetSortOrder === null || targetSortOrder === undefined) {
          return;
        }

        for (let i = oldIndex - 1; i >= newIndex; i--) {
          const currentItem = displayItems[i];
          const nextItem = displayItems[i + 1];
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
        researchMethods.refetch();
      }
    } catch (error) {
      console.error('Ошибка при обновлении порядка сортировки:', error);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleAddMethod = () => {
    setIsCreateCalculationModalOpen(true);
  };

  const handleCalculationModalClose = () => {
    setIsCreateCalculationModalOpen(false);
    setEditCalculationMethodId(undefined);
  };

  const handleCalculationModalSuccess = (payload?: unknown) => {
    setIsCreateCalculationModalOpen(false);
    setEditCalculationMethodId(undefined);
    researchMethods.refetch();
    const method =
      payload && typeof payload === 'object' && 'formula' in payload
        ? (payload as ResearchMethod)
        : null;
    if (method?.id != null) {
      setSelectedMethodId(method.id);
    }
  };

  const handleEditCalculationMethod = (methodId: number) => {
    setEditCalculationMethodId(methodId);
    setIsCreateCalculationModalOpen(true);
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
      message.warning('Сначала выберите метод исследования');
      return;
    }
    setIsEquipmentModalOpen(true);
  };

  const handleCloseEquipmentModal = () => {
    setIsEquipmentModalOpen(false);
  };

  const handleCalculate = async (
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

  const handleLaboratoryActivityDateChange = useCallback(
    (date: Dayjs | null) => {
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
    },
    [currentMethod]
  );

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

    // Очищаем результаты
    if (currentMethod) {
      setLastCalculationResult(prev => {
        const newResult = { ...prev };
        delete newResult[currentMethod.id];
        return newResult;
      });
    }
  };

  const handleLoadRegistrationData = async () => {
    if (!dataLoadedCallback) {
      return;
    }
    if (!registrationNumber || !currentMethod) {
      message.warning('Введите регистрационный номер пробы');
      return;
    }

    setIsLoadingRegistrationData(true);

    try {
      const samplesResponse = await samplesApi.getSamples(
        undefined,
        undefined,
        { registration_number: registrationNumber },
        undefined,
        labId,
        deptId
      );

      if (!samplesResponse.items.length) {
        throw new Error('Проба не найдена');
      }

      // Ищем пробу, у которой есть расчет по текущему методу
      let targetSample = null;
      let targetCalculation = null;

      for (const sample of samplesResponse.items) {
        // Получаем расчеты для этой пробы
        const calculations = await calculationApi.getCalculationsBySample(sample.id);

        // Ищем расчет по текущему методу
        const calculation = calculations.find(calc => calc.research_method_id === currentMethod.id);

        if (calculation) {
          targetSample = sample;
          targetCalculation = calculation;
          break;
        }
      }

      if (!targetSample || !targetCalculation) {
        // Проверяем, есть ли вообще расчеты для этих проб
        const allCalculations: Array<{ research_method_id: number }> = [];
        for (const sample of samplesResponse.items) {
          const calculations = await calculationApi.getCalculationsBySample(sample.id);
          allCalculations.push(...calculations);
        }

        if (allCalculations.length === 0) {
          throw new Error('Для данной пробы не найдено ни одного расчета');
        } else {
          const availableMethods = allCalculations.map(calc => calc.research_method_id);
          const methodNames = methods.filter(m => availableMethods.includes(m.id)).map(m => m.name);
          throw new Error(
            `Для данной пробы нет расчетов по методу "${currentMethod.name}". ` +
              `Доступные методы: ${methodNames.join(', ')}`
          );
        }
      }

      // Проверяем, что структура полей ввода совпадает
      const inputData = targetCalculation.input_data as Record<string, unknown>;
      let calculationInputFields: string[] = [];

      // Обработка для фракционного состава
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

      // Проверяем, что все поля из расчета есть в текущем методе (исключаем поля фракционного состава)
      const extraFields = uniqueCalculationInputFields.filter(
        field => !uniqueCurrentMethodFields.includes(field) && field !== '_fractional_data'
      );
      if (extraFields.length > 0) {
        throw new Error(
          `Структура метода изменилась. Лишние поля в расчете: ${extraFields.join(', ')}`
        );
      }

      const prefill = buildCalculationFormPrefill(currentMethod, targetCalculation);

      dataLoadedCallback({
        initialValues: prefill.initialValues,
        laboratoryActivityDate: prefill.laboratoryActivityDate,
      });

      message.success('Данные успешно загружены');
    } catch (error: unknown) {
      console.error('Ошибка при получении данных:', error);
      message.error(
        error instanceof Error ? error.message : 'Не удалось загрузить данные по указанному номеру'
      );
    } finally {
      setIsLoadingRegistrationData(false);
    }
  };

  const handleRegistrationDataLoader = useCallback(
    (
      callback: (data: {
        initialValues: Record<string, string>;
        laboratoryActivityDate: Dayjs | null;
      }) => void
    ) => {
      setDataLoadedCallback(() => callback);
    },
    []
  );

  const leftPanel = (
    <MethodsPanel
      methods={methods}
      displayItems={displayItems}
      selectedMethodId={selectedMethodId}
      isLoading={researchMethods.methods.isLoading || researchMethods.groups.isLoading}
      activeId={activeId}
      showAddButton={showAddButton}
      onAddMethod={handleAddMethod}
      onMethodClick={handleMethodClick}
      onMethodEdit={handleEditCalculationMethod}
      onMethodDelete={handleMethodDelete}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    />
  );

  const rightPanel = (
    <div className="admin-page-right-panel">
      <div className="admin-page-right-panel-header">
        {labId && (
          <div className="admin-page-registration-wrapper">
            <RegistrationNumberPicker
              value={registrationNumber}
              onChange={val => setRegistrationNumber(val)}
              laboratoryId={labId}
              departmentId={deptId}
              methodId={currentMethod?.id || null}
              className="admin-page-registration-input"
            />
            <Button
              onClick={handleLoadRegistrationData}
              loading={isLoadingRegistrationData}
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              Показать
            </Button>
          </div>
        )}
        <Tooltip title="Приборы по умолчанию" placement="top">
          <Button
            icon={<SettingOutlined />}
            className="admin-page-button-settings"
            onClick={handleOpenEquipmentModal}
            disabled={!currentMethod}
          />
        </Tooltip>
      </div>
      <CalculationPanel
        hasNoMethods={hasNoMethods}
        selectedMethodId={selectedMethodId}
        methods={methods}
        groups={groups}
        groupSelector={
          shouldShowGroupSelector ? (
            <Select
              value={selectedMethodId}
              onChange={value => {
                const methodId = typeof value === 'number' ? value : null;
                setSelectedMethodId(methodId);
              }}
              className="admin-page-select research-method-select"
            >
              {groupMethods.map(method => (
                <Option key={method.id} value={method.id}>
                  {method.name === 'Фракционный состав (конденсат)'
                    ? 'Конденсат'
                    : method.name === 'Фракционный состав (нефть)'
                      ? 'Нефть'
                      : method.name}
                </Option>
              ))}
            </Select>
          ) : undefined
        }
        onCalculate={handleCalculate}
        onSave={handleOpenSaveModal}
        lastCalculationResult={currentMethod ? lastCalculationResult[currentMethod.id] : undefined}
        onLaboratoryActivityDateChange={handleLaboratoryActivityDateChange}
        laboratoryId={labId}
        departmentId={deptId}
        onLoadRegistrationData={handleRegistrationDataLoader}
      />
    </div>
  );

  if (!canAccessFeatureRoute('laboratory_management', 'access', labId, deptId)) {
    return <Navigate to="/403" replace />;
  }

  return (
    <Layout title="Администрирование">
      <NavigationBar breadcrumbs={getBreadcrumbs()} onBack={handleBack} showBack={true} />
      <SplitPanel leftPanel={leftPanel} rightPanel={rightPanel} />
      <CreateCalculationModal
        isOpen={isCreateCalculationModalOpen}
        onClose={handleCalculationModalClose}
        onSuccess={handleCalculationModalSuccess}
        laboratoryId={laboratoryId ? parseInt(laboratoryId, 10) : undefined}
        departmentId={departmentId ? parseInt(departmentId, 10) : undefined}
        laboratoryName={laboratory?.name}
        departmentName={department?.name}
        editMethodId={editCalculationMethodId}
      />
      <ConfirmationModal
        open={deleteConfirmation.isOpen}
        title={
          deleteConfirmation.itemType === 'method'
            ? 'Скрытие метода исследования'
            : 'Удаление группы методов'
        }
        message={
          deleteConfirmation.itemType === 'method'
            ? `Вы действительно хотите скрыть метод исследования "${deleteConfirmation.itemName}"?`
            : `Вы действительно хотите удалить группу "${deleteConfirmation.itemName}"? Методы группы тоже будут скрыты.`
        }
        confirmText={deleteConfirmation.itemType === 'method' ? 'Скрыть' : 'Удалить группу'}
        cancelText="Отмена"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        modalWidth="450"
      />
      {isEquipmentModalOpen && currentMethod && (
        <EquipmentDefaultModal
          open={isEquipmentModalOpen}
          onClose={handleCloseEquipmentModal}
          currentMethod={currentMethod}
          laboratoryId={labId}
          departmentId={deptId}
        />
      )}
      {currentMethod && lastCalculationResult[currentMethod.id] && (
        <SaveCalculationModal
          open={isSaveCalculationModalOpen}
          onClose={() => setIsSaveCalculationModalOpen(false)}
          onSuccess={handleSaveSuccess}
          calculationData={{
            input_data: lastCalculationResult[currentMethod.id].input_data,
            result: lastCalculationResult[currentMethod.id].result,
            measurement_error: lastCalculationResult[currentMethod.id].measurement_error,
            unit: lastCalculationResult[currentMethod.id].unit,
          }}
          laboratoryActivityDate={lastCalculationResult[currentMethod.id].laboratory_activity_date}
          laboratoryId={labId!}
          departmentId={deptId}
          researchMethodId={currentMethod.id}
          equipment_data={lastCalculationResult[currentMethod.id].equipment_data}
        />
      )}
    </Layout>
  );
};

export default AdminPage;
