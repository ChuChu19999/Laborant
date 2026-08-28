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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  MethodListItem,
  SortableMethodListItem,
  type ResearchMethod,
  type ResearchMethodGroup,
} from '@/entities/ResearchMethod';
import { Button } from '@/shared/ui/Button';
import { PlusOutlined } from '@/shared/ui/icons';
import { Spin } from '@/shared/ui/Spin';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import './MethodsPanel.css';

type ListItem =
  | { type: 'method'; id: number; data: ResearchMethod }
  | { type: 'group'; id: number; data: ResearchMethodGroup };

interface MethodsPanelProps {
  methods: ResearchMethod[];
  displayItems: ListItem[];
  selectedMethodId: number | null;
  isLoading: boolean;
  activeId: string | null;
  showAddButton: boolean;
  onAddMethod: () => void;
  onMethodClick: (itemId: number, itemType: 'method' | 'group') => void;
  onMethodEdit?: (methodId: number) => void;
  onMethodDelete: (itemId: number, itemType: 'method' | 'group') => void;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
}

/** Панель списка методов исследования с drag-and-drop сортировкой. */
const MethodsPanel = ({
  methods,
  displayItems,
  selectedMethodId,
  isLoading,
  activeId,
  showAddButton,
  onAddMethod,
  onMethodClick,
  onMethodEdit,
  onMethodDelete,
  onDragStart,
  onDragEnd,
  onDragCancel,
}: MethodsPanelProps) => {
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

  const hasNoMethods = displayItems.length === 0;

  return (
    <div className="methods-panel">
      <div className="methods-panel-header">
        <h3 className="methods-panel-title">Методы исследования</h3>
        {showAddButton && (
          <Button
            unwrapped
            aria-label="добавить метод"
            type="text"
            size="small"
            onClick={onAddMethod}
            className="methods-panel-add-button"
            icon={<PlusOutlined className="methods-panel-add-icon" />}
          />
        )}
      </div>
      <div className="methods-panel-content">
        {isLoading ? (
          <div className="methods-panel-empty methods-panel-spinner">
            <Spin spinning>
              <div className="methods-panel-spinner-placeholder" />
            </Spin>
          </div>
        ) : hasNoMethods ? (
          <div className="methods-panel-empty">Нет активных методов исследования</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            <SortableContext
              items={displayItems.map(item => `${item.type}-${item.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="methods-panel-methods">
                {displayItems.map(item => {
                  if (item.type === 'method') {
                    const method = item.data;
                    const isActive = selectedMethodId === method.id;
                    return (
                      <SortableMethodListItem
                        key={`method-${method.id}`}
                        id={`method-${method.id}`}
                        name={method.name}
                        isActive={isActive}
                        isEditable={true}
                        onClick={() => onMethodClick(method.id, 'method')}
                        onEdit={onMethodEdit ? () => onMethodEdit(method.id) : undefined}
                        onDelete={() => onMethodDelete(method.id, 'method')}
                      />
                    );
                  }
                  const group = item.data;
                  const groupMethods = methods.filter(m =>
                    group.methods.some(gm => gm.id === m.id)
                  );
                  const isActive = groupMethods.some(m => selectedMethodId === m.id);
                  const selectedInGroup =
                    selectedMethodId != null && groupMethods.some(m => m.id === selectedMethodId);
                  return (
                    <SortableMethodListItem
                      key={`group-${group.id}`}
                      id={`group-${group.id}`}
                      name={group.name}
                      isActive={isActive}
                      isEditable={true}
                      onClick={() => onMethodClick(group.id, 'group')}
                      onEdit={
                        onMethodEdit && selectedInGroup && selectedMethodId != null
                          ? () => onMethodEdit(selectedMethodId)
                          : undefined
                      }
                      onDelete={() => onMethodDelete(group.id, 'group')}
                    />
                  );
                })}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId
                ? (() => {
                    const activeIdStr = String(activeId);
                    if (!activeIdStr.includes('-')) {
                      return null;
                    }
                    const [type, idStr] = activeIdStr.split('-');
                    if (idStr === undefined) {
                      return null;
                    }
                    const id = parseInt(idStr, 10);
                    if (isNaN(id) || (type !== 'method' && type !== 'group')) {
                      return null;
                    }
                    const overlayItem = displayItems.find(
                      listItem => listItem.id === id && listItem.type === type
                    );
                    return overlayItem ? (
                      <div className="drag-overlay-item">
                        <MethodListItem
                          name={
                            overlayItem.type === 'method'
                              ? overlayItem.data.name
                              : overlayItem.data.name
                          }
                          isActive={false}
                          isEditable={true}
                        />
                      </div>
                    ) : null;
                  })()
                : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
};

export default MethodsPanel;
