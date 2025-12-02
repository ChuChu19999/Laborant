import { useState, useEffect } from 'react';
import { MenuOutlined } from '@ant-design/icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { LoadingCard } from '../../../features/Cards';
import { researchApi, type ResearchMethodResponse } from '../../../shared/api/research';
import './ResearchMethodsList.css';

interface ResearchMethodsListProps {
  methods: ResearchMethodResponse[];
  isLoading?: boolean;
  selectedMethodId: number | null;
  onMethodSelect: (methodId: number) => void;
  onAddClick: () => void;
  laboratoryId?: number;
  departmentId?: number;
}

interface SortableMethodItemProps {
  method: ResearchMethodResponse;
  isSelected: boolean;
  onSelect: () => void;
}

const SortableMethodItem: React.FC<SortableMethodItemProps> = ({
  method,
  isSelected,
  onSelect,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: method.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`method-item ${isSelected ? 'active' : ''}`}
      onClick={onSelect}
    >
      <div className="method-item-content">
        <div {...attributes} {...listeners} className="method-drag-handle">
          <MenuOutlined />
        </div>
        <div className="method-item-info">
          <div className="method-item-name">{method.name}</div>
          {method.unit && <div className="method-item-unit">{method.unit}</div>}
        </div>
      </div>
    </div>
  );
};

const ResearchMethodsList: React.FC<ResearchMethodsListProps> = ({
  methods,
  isLoading = false,
  selectedMethodId,
  onMethodSelect,
  onAddClick,
}) => {
  const queryClient = useQueryClient();
  const [localMethods, setLocalMethods] = useState(methods);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateSortOrderMutation = useMutation({
    mutationFn: async (updates: Array<{ id: number; sort_order: number }>) => {
      // Обновляем порядок для всех методов
      await Promise.all(
        updates.map(update =>
          researchApi.updateResearchMethodSortOrder(update.id, { sort_order: update.sort_order })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-methods'] });
    },
    onError: () => {
      message.error('Не удалось обновить порядок методов');
      // Откатываем изменения
      setLocalMethods(methods);
    },
  });

  // Синхронизируем локальное состояние с пропсами
  useEffect(() => {
    setLocalMethods(methods);
  }, [methods]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = localMethods.findIndex(m => m.id === active.id);
    const newIndex = localMethods.findIndex(m => m.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const newMethods = arrayMove(localMethods, oldIndex, newIndex);
    setLocalMethods(newMethods);

    // Обновляем sort_order на сервере
    const updates = newMethods.map((method, index) => ({
      id: method.id,
      sort_order: index,
    }));

    updateSortOrderMutation.mutate(updates);
  };

  if (isLoading) {
    return <LoadingCard />;
  }

  return (
    <div className="research-methods-list">
      <div className="methods-header">
        <h3>Методы исследования</h3>
        <button className="add-method-btn" onClick={onAddClick}>
          + Добавить
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={localMethods.map(m => m.id)} strategy={verticalListSortingStrategy}>
          <div className="methods-list">
            {localMethods.length === 0 ? (
              <div className="empty-methods">
                <p>Методы исследования не найдены</p>
              </div>
            ) : (
              localMethods.map(method => (
                <SortableMethodItem
                  key={method.id}
                  method={method}
                  isSelected={selectedMethodId === method.id}
                  onSelect={() => onMethodSelect(method.id)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default ResearchMethodsList;
