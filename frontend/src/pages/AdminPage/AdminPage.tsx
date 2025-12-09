import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AddIcon from '@mui/icons-material/Add';
import { IconButton } from '@mui/material';
import { message } from 'antd';
import { ConfirmationModal } from '../../entities/ConfirmationModal';
import { MethodListItem } from '../../entities/MethodListItem';
import { CreateCalculationModal } from '../../features/Modals';
import { laboratoriesApi } from '../../shared/api/laboratories';
import { researchApi } from '../../shared/api/research';
import Layout from '../../shared/ui/Layout/Layout';
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
  const [methods, setMethods] = useState<ResearchMethod[]>([]);
  const [groups, setGroups] = useState<ResearchMethodGroup[]>([]);
  const [displayItems, setDisplayItems] = useState<ListItem[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [showAddButton] = useState(true);
  const [laboratory, setLaboratory] = useState<Laboratory | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [isCreateCalculationModalOpen, setIsCreateCalculationModalOpen] = useState(false);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadMethods = useCallback(async () => {
    if (!laboratoryId) return;

    try {
      setIsLoadingMethods(true);
      const labId = parseInt(laboratoryId, 10);
      const deptId = departmentId ? parseInt(departmentId, 10) : undefined;

      if (!isNaN(labId)) {
        const [methodsResponse, groupsResponse] = await Promise.all([
          researchApi.getResearchMethods({
            laboratory_id: labId,
            department_id: deptId,
            page_size: 100,
            sort_by: 'sort_order',
            sort_order: 'asc',
          }),
          researchApi.getResearchMethodGroups({
            page_size: 100,
            sort_by: 'sort_order',
            sort_order: 'asc',
          }),
        ]);

        const activeMethods = methodsResponse.items.filter(method => !method.deleted_at);
        activeMethods.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        setMethods(activeMethods);

        const activeGroups = groupsResponse.items.filter(group => !group.deleted_at);
        activeGroups.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        setGroups(activeGroups);

        const methodIdsInGroups = new Set<number>();
        activeGroups.forEach(group => {
          group.methods.forEach(method => {
            methodIdsInGroups.add(method.id);
          });
        });

        const items: ListItem[] = [];
        const standaloneMethods = activeMethods.filter(method => !methodIdsInGroups.has(method.id));

        standaloneMethods.forEach(method => {
          items.push({ type: 'method', id: method.id, data: method });
        });

        activeGroups.forEach(group => {
          const groupMethods = activeMethods.filter(method =>
            group.methods.some(gm => gm.id === method.id)
          );
          if (groupMethods.length > 0) {
            items.push({ type: 'group', id: group.id, data: group });
          }
        });

        items.sort((a, b) => {
          const aOrder = a.type === 'method' ? a.data.sort_order || 0 : a.data.sort_order || 0;
          const bOrder = b.type === 'method' ? b.data.sort_order || 0 : b.data.sort_order || 0;
          return aOrder - bOrder;
        });

        setDisplayItems(items);
      }
    } catch (error) {
      console.error('Ошибка при загрузке методов:', error);
      message.error('Не удалось загрузить список методов исследования');
    } finally {
      setIsLoadingMethods(false);
    }
  }, [laboratoryId, departmentId]);

  useEffect(() => {
    const fetchData = async () => {
      if (laboratoryId) {
        try {
          const labId = parseInt(laboratoryId, 10);
          if (!isNaN(labId)) {
            const labData = await laboratoriesApi.getLaboratory(labId);
            setLaboratory(labData);
          }
        } catch (error) {
          console.error('Ошибка при загрузке лаборатории:', error);
        }
      }

      if (departmentId && laboratoryId) {
        try {
          const deptId = parseInt(departmentId, 10);
          const labId = parseInt(laboratoryId, 10);
          if (!isNaN(deptId) && !isNaN(labId)) {
            const departments = await laboratoriesApi.getDepartmentsByLaboratory(labId);
            const foundDepartment = departments.find(dept => dept.id === deptId);
            if (foundDepartment) {
              setDepartment(foundDepartment);
            }
          }
        } catch (error) {
          console.error('Ошибка при загрузке подразделения:', error);
        }
      }
    };

    fetchData();
    loadMethods();
  }, [laboratoryId, departmentId, loadMethods]);

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
        await researchApi.deleteResearchMethod(deleteConfirmation.itemId);
        message.success('Метод исследования скрыт');
      } else {
        await researchApi.deleteResearchMethodGroup(deleteConfirmation.itemId);
        message.success('Группа методов исследования и все ее методы скрыты');
      }
      setDeleteConfirmation({
        isOpen: false,
        itemId: null,
        itemType: null,
        itemName: null,
      });
      await loadMethods();
    } catch (error) {
      console.error('Ошибка при скрытии:', error);
      message.error(
        deleteConfirmation.itemType === 'method'
          ? 'Не удалось скрыть метод исследования'
          : 'Не удалось скрыть группу методов исследования'
      );
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

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const newItems = arrayMove(displayItems, oldIndex, newIndex);
    setDisplayItems(newItems);

    try {
      const item = displayItems[oldIndex];
      const targetItem = displayItems[newIndex];
      const targetSortOrder = targetItem.data.sort_order ?? 0;

      if (item.type === 'method') {
        await researchApi.updateResearchMethodSortOrder(item.data.id, targetSortOrder);
        message.success('Порядок сортировки метода обновлен');
      } else {
        await researchApi.updateResearchMethodGroup(item.data.id, { sort_order: targetSortOrder });
        message.success('Порядок сортировки группы обновлен');
      }
    } catch (error) {
      console.error('Ошибка при обновлении порядка сортировки:', error);
      message.error('Не удалось обновить порядок сортировки');
      await loadMethods();
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

  const handleCalculationModalSuccess = async () => {
    setIsCreateCalculationModalOpen(false);
    await loadMethods();
  };

  const hasNoMethods = displayItems.length === 0;

  const leftPanel = (
    <div className="admin-left-panel">
      <div className="admin-left-panel-header">
        <h3 className="admin-left-panel-title">Методы исследования</h3>
        {showAddButton && (
          <IconButton
            aria-label="добавить метод"
            size="small"
            onClick={handleAddMethod}
            className="admin-left-panel-add-button"
          >
            <AddIcon fontSize="small" className="admin-left-panel-add-icon" />
          </IconButton>
        )}
      </div>
      <div className="admin-left-panel-content">
        {isLoadingMethods ? (
          <div className="admin-left-panel-empty">Загрузка методов...</div>
        ) : hasNoMethods ? (
          <div className="admin-left-panel-empty">Нет активных методов исследования</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={displayItems.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="admin-left-panel-methods">
                {displayItems.map(item => {
                  if (item.type === 'method') {
                    const method = item.data;
                    const isActive = selectedMethodId === method.id;
                    return (
                      <SortableMethodListItem
                        key={`method-${method.id}`}
                        id={method.id}
                        name={method.name}
                        isActive={isActive}
                        isEditable={true}
                        onClick={() => handleMethodClick(method.id, 'method')}
                        onDelete={() => handleMethodDelete(method.id, 'method')}
                      />
                    );
                  } else {
                    const group = item.data;
                    const groupMethods = methods.filter(m =>
                      group.methods.some(gm => gm.id === m.id)
                    );
                    const isActive = groupMethods.some(m => selectedMethodId === m.id);
                    return (
                      <SortableMethodListItem
                        key={`group-${group.id}`}
                        id={group.id}
                        name={group.name}
                        isActive={isActive}
                        isEditable={true}
                        onClick={() => handleMethodClick(group.id, 'group')}
                        onDelete={() => handleMethodDelete(group.id, 'group')}
                      />
                    );
                  }
                })}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId ? (
                <div className="drag-overlay-item">
                  <MethodListItem
                    name={
                      displayItems.find(item => item.id === activeId)?.type === 'method'
                        ? (displayItems.find(item => item.id === activeId)?.data as ResearchMethod)
                            .name
                        : (
                            displayItems.find(item => item.id === activeId)
                              ?.data as ResearchMethodGroup
                          ).name
                    }
                    isActive={false}
                    isEditable={true}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );

  const rightPanel = (
    <div className="admin-right-panel">
      {hasNoMethods ? (
        <div className="admin-right-panel-empty">
          <h3 className="admin-right-panel-empty-title">Методы исследования отсутствуют</h3>
          <p className="admin-right-panel-empty-description">
            Добавьте первый метод исследования, нажав на кнопку "+" в левой панели
          </p>
        </div>
      ) : (
        <p>Панель расчетов будет здесь</p>
      )}
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
        style={{ width: '450px', zIndex: 1000 }}
      />
    </Layout>
  );
};

interface SortableMethodListItemProps {
  id: number;
  name: string;
  isActive: boolean;
  isEditable: boolean;
  onClick: () => void;
  onDelete: () => void;
}

const SortableMethodListItem: React.FC<SortableMethodListItemProps> = ({
  id,
  name,
  isActive,
  isEditable,
  onClick,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete();
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-item-wrapper">
      <MethodListItem
        name={name}
        isActive={isActive}
        isEditable={isEditable}
        onClick={onClick}
        onDelete={handleDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
};

export default AdminPage;
