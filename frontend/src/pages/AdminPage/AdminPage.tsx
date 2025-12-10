import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { ConfirmationModal } from '../../entities/ConfirmationModal';
import { CreateCalculationModal } from '../../features/Modals';
import { laboratoriesApi } from '../../shared/api/laboratories';
import { researchApi } from '../../shared/api/research';
import {
  useResearchMethods,
  useDeleteResearchMethod,
  useDeleteResearchMethodGroup,
} from '../../shared/model/hooks';
import { useAutoRefetchQuery } from '../../shared/model/lib/useQuery';
import { useQueryStore } from '../../shared/model/stores';
import Layout from '../../shared/ui/Layout/Layout';
import { CalculationPanel } from '../../widgets/CalculationPanel';
import { MethodsPanel } from '../../widgets/MethodsPanel';
import { NavigationBar } from '../../widgets/NavigationBar';
import { SplitPanel } from '../../widgets/SplitPanel';
import type { Laboratory, Department } from '../../shared/api/laboratories';
import type { ResearchMethod, ResearchMethodGroup } from '../../shared/api/research';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import './AdminPage.css';

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
  const [activeId, setActiveId] = useState<number | null>(null);
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
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = displayItems.findIndex(item => item.id === active.id);
    const newIndex = displayItems.findIndex(item => item.id === over.id);

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
        await researchApi.batchUpdateSortOrder(
          itemsToUpdate.map(update => ({
            id: update.id,
            type: update.type,
            sort_order: update.sort_order,
          }))
        );
        message.success('Порядок сортировки успешно обновлен');
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

  const rightPanel = <CalculationPanel hasNoMethods={hasNoMethods} />;

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
    </Layout>
  );
};

export default AdminPage;
