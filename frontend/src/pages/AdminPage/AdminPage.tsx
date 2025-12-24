import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SettingOutlined } from '@ant-design/icons';
import { Dropdown, message } from 'antd';
import { ConfirmationModal } from '../../entities/ConfirmationModal';
import RegistrationNumberPicker from '../../entities/RegistrationNumberPicker/ui/RegistrationNumberPicker';
import {
  CreateCalculationModal,
  SaveCalculationModal,
  SelectionConditionsModal,
  MassFractionOilRefractionDirectoryModal,
  EquipmentDefaultModal,
  EditProtocolTemplateModal,
} from '../../features/Modals';
import { calculationApi } from '../../shared/api/calculation';
import { laboratoriesApi } from '../../shared/api/laboratories';
import { samplesApi } from '../../shared/api/samples';
import {
  useResearchMethods,
  useDeleteResearchMethod,
  useDeleteResearchMethodGroup,
  useBatchUpdateSortOrder,
} from '../../shared/model/hooks';
import { useAutoRefetchQuery } from '../../shared/model/lib/useQuery';
import { useQueryStore } from '../../shared/model/stores';
import Button from '../../shared/ui/Button/Button';
import { Select } from '../../shared/ui/FormItems';
import Layout from '../../shared/ui/Layout/Layout';
import { formatNumberForDisplay } from '../../shared/utils/numberFormatting';
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
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [showAddButton] = useState(true);
  const [isCreateCalculationModalOpen, setIsCreateCalculationModalOpen] = useState(false);
  const [isSelectionConditionsModalOpen, setIsSelectionConditionsModalOpen] = useState(false);
  const [isRefractionTableModalOpen, setIsRefractionTableModalOpen] = useState(false);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [isProtocolTemplateModalOpen, setIsProtocolTemplateModalOpen] = useState(false);
  const [isSaveCalculationModalOpen, setIsSaveCalculationModalOpen] = useState(false);
  const [lastCalculationResult, setLastCalculationResult] = useState<
    Record<
      number,
      {
        input_data: Record<string, unknown>;
        result: string;
        measurement_error?: string;
        unit?: string;
        convergence?: string;
        laboratory_activity_date: Dayjs | null;
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
    if (deptId) {
      setResearchMethodsDepartmentId(deptId);
    }
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
          setSelectedMethodId(group.methods[0].id);
        }
      }
    }
  }, [displayItems, groups, selectedMethodId]);

  useEffect(() => {
    if (selectedMethodId) {
      setRegistrationNumber('');
    }
  }, [selectedMethodId]);

  const handleBack = () => {
    if (laboratoryId) {
      navigate(`/?page=laboratory-management&viewMode=departments&laboratoryId=${laboratoryId}`);
    } else {
      navigate('/?page=laboratory-management');
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleBackToLaboratories = () => {
    navigate('/?page=laboratory-management');
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
        setSelectedMethodId(group.methods[0].id);
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
  };

  const handleCalculationModalSuccess = () => {
    setIsCreateCalculationModalOpen(false);
    researchMethods.refetch();
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
    return methods.filter(m => currentMethodGroup.methods.some(gm => gm.id === m.id));
  }, [currentMethodGroup, methods]);

  const shouldShowGroupSelector = useMemo(() => {
    if (!currentMethodGroup || groupMethods.length <= 1) return false;
    return true;
  }, [currentMethodGroup, groupMethods]);

  const handleOpenSelectionConditionsModal = () => {
    setIsSelectionConditionsModalOpen(true);
  };

  const handleCloseSelectionConditionsModal = () => {
    setIsSelectionConditionsModalOpen(false);
  };

  const handleOpenRefractionTableModal = () => {
    setIsRefractionTableModalOpen(true);
  };

  const handleCloseRefractionTableModal = () => {
    setIsRefractionTableModalOpen(false);
  };

  const handleOpenEquipmentModal = () => {
    setIsEquipmentModalOpen(true);
  };

  const handleCloseEquipmentModal = () => {
    setIsEquipmentModalOpen(false);
  };

  const handleOpenProtocolTemplateModal = () => {
    setIsProtocolTemplateModalOpen(true);
  };

  const handleCloseProtocolTemplateModal = () => {
    setIsProtocolTemplateModalOpen(false);
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
        measurement_error: result.measurement_error,
        unit: result.unit,
        convergence: result.convergence,
        laboratory_activity_date: laboratoryActivityDate,
      },
    }));
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

      // Проверяем, что все поля текущего метода есть в расчете
      const missingFields = currentMethodFields.filter(
        field => !calculationInputFields.includes(field)
      );
      if (missingFields.length > 0) {
        throw new Error(
          `Структура метода изменилась. Отсутствуют поля: ${missingFields.join(', ')}`
        );
      }

      // Проверяем, что все поля из расчета есть в текущем методе (исключаем поля фракционного состава)
      const extraFields = calculationInputFields.filter(
        field => !currentMethodFields.includes(field) && field !== '_fractional_data'
      );
      if (extraFields.length > 0) {
        throw new Error(
          `Структура метода изменилась. Лишние поля в расчете: ${extraFields.join(', ')}`
        );
      }

      const initialValues: Record<string, string> = {};

      // Обработка для фракционного состава
      if (
        currentMethod.name === 'Фракционный состав (конденсат)' ||
        currentMethod.name === 'Фракционный состав (нефть)'
      ) {
        // Проверяем, есть ли данные в _fractional_data
        const inputData = targetCalculation.input_data as Record<string, unknown>;
        if (inputData._fractional_data) {
          const fractionalData = inputData._fractional_data as {
            card1?: Record<string, unknown>;
            card2?: Record<string, unknown>;
          };

          // Заполняем данные для card1
          if (fractionalData.card1) {
            Object.entries(fractionalData.card1).forEach(([fieldName, value]) => {
              const formFieldName = `${currentMethod.id}_${fieldName}`;
              initialValues[formFieldName] =
                value && (typeof value === 'string' || typeof value === 'number')
                  ? formatNumberForDisplay(value)
                  : '';
            });
          }

          // Заполняем данные для card2
          if (fractionalData.card2) {
            Object.entries(fractionalData.card2).forEach(([fieldName, value]) => {
              const formFieldName = `${currentMethod.id}_${fieldName}_card_2`;
              initialValues[formFieldName] =
                value && (typeof value === 'string' || typeof value === 'number')
                  ? formatNumberForDisplay(value)
                  : '';
            });
          }
        } else {
          // Если не фракционный состав, используем обычную обработку
          Object.entries(targetCalculation.input_data).forEach(([fieldName, value]) => {
            const field = currentMethod.input_data.fields.find(f => f.name === fieldName);
            const cardIndex = field?.card_index || 1;

            const formFieldName =
              cardIndex > 1
                ? `${currentMethod.id}_${fieldName}_card_${cardIndex}`
                : `${currentMethod.id}_${fieldName}`;

            initialValues[formFieldName] =
              value && (typeof value === 'string' || typeof value === 'number')
                ? formatNumberForDisplay(value)
                : '';
          });
        }
      } else {
        // Обычная обработка для других методов
        Object.entries(targetCalculation.input_data).forEach(([fieldName, value]) => {
          // Находим поле в текущем методе для определения card_index
          const field = currentMethod.input_data.fields.find(f => f.name === fieldName);
          const cardIndex = field?.card_index || 1;

          // Для поля "Цвет" в методе "Массовая доля нефти" используем специальную логику
          const isColorField = currentMethod.name === 'Массовая доля нефти' && fieldName === 'Цвет';
          const formFieldName = isColorField
            ? `${currentMethod.id}_${fieldName}`
            : cardIndex > 1
              ? `${currentMethod.id}_${fieldName}_card_${cardIndex}`
              : `${currentMethod.id}_${fieldName}`;

          initialValues[formFieldName] =
            value && (typeof value === 'string' || typeof value === 'number')
              ? formatNumberForDisplay(value)
              : '';
        });
      }

      // Устанавливаем дату лабораторной деятельности
      let laboratoryActivityDate: Dayjs | null = null;
      if (targetCalculation.laboratory_activity_date) {
        const dayjs = (await import('dayjs')).default;
        const date = dayjs(targetCalculation.laboratory_activity_date);
        if (date.isValid()) {
          laboratoryActivityDate = date;
        }
      }

      dataLoadedCallback({
        initialValues,
        laboratoryActivityDate,
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
        <Dropdown
          menu={{
            items: [
              {
                key: 'protocol-template',
                label: 'Шаблон протокола',
                onClick: handleOpenProtocolTemplateModal,
              },
              {
                key: 'selection-conditions',
                label: 'Условия отбора',
                onClick: handleOpenSelectionConditionsModal,
              },
              {
                key: 'equipment',
                label: 'Приборы по умолчанию',
                onClick: handleOpenEquipmentModal,
                disabled: !currentMethod,
              },
              ...(currentMethod && currentMethod.name === 'Массовая доля нефти'
                ? [
                    {
                      key: 'refraction-table',
                      label: 'Справочник массовой доли нефти',
                      onClick: handleOpenRefractionTableModal,
                    },
                  ]
                : []),
            ],
          }}
          trigger={['click']}
        >
          <Button icon={<SettingOutlined />} className="admin-page-button-settings" />
        </Dropdown>
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
        laboratoryId={labId}
        departmentId={deptId}
        onLoadRegistrationData={handleRegistrationDataLoader}
      />
    </div>
  );

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
      />
      <ConfirmationModal
        open={deleteConfirmation.isOpen}
        title={
          deleteConfirmation.itemType === 'method'
            ? 'Скрытие метода исследования'
            : 'Скрытие группы методов исследования'
        }
        message={
          deleteConfirmation.itemType === 'method'
            ? `Вы действительно хотите скрыть метод исследования "${deleteConfirmation.itemName}"?`
            : `Вы действительно хотите скрыть группу методов исследования "${deleteConfirmation.itemName}"? При этом будут скрыты все методы, входящие в эту группу.`
        }
        confirmText="Скрыть"
        cancelText="Отмена"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        modalWidth="450"
      />
      {isSelectionConditionsModalOpen && (
        <SelectionConditionsModal
          open={isSelectionConditionsModalOpen}
          onClose={handleCloseSelectionConditionsModal}
          laboratoryId={labId}
          departmentId={deptId}
          entityName={department?.name || laboratory?.name}
        />
      )}
      {isRefractionTableModalOpen && currentMethod && (
        <MassFractionOilRefractionDirectoryModal
          open={isRefractionTableModalOpen}
          onClose={handleCloseRefractionTableModal}
          researchMethodId={currentMethod.id}
          methodName={currentMethod.name}
        />
      )}
      {isEquipmentModalOpen && currentMethod && (
        <EquipmentDefaultModal
          open={isEquipmentModalOpen}
          onClose={handleCloseEquipmentModal}
          currentMethod={currentMethod}
          laboratoryId={labId}
          departmentId={deptId}
        />
      )}
      {isProtocolTemplateModalOpen && labId && (
        <EditProtocolTemplateModal
          open={isProtocolTemplateModalOpen}
          onClose={handleCloseProtocolTemplateModal}
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
        />
      )}
    </Layout>
  );
};

export default AdminPage;
