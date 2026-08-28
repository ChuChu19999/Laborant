import { useLayoutEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import MethodListItem from './MethodListItem';
import type { MouseEvent } from 'react';
import './SortableMethodListItem.css';

interface SortableMethodListItemProps {
  id: number | string;
  name: string;
  isActive: boolean;
  isEditable: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const SortableMethodListItem = ({
  id,
  name,
  isActive,
  isEditable,
  onClick,
  onEdit,
  onDelete,
}: SortableMethodListItemProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const setRefs = (node: HTMLDivElement | null) => {
    wrapperRef.current = node;
    setNodeRef(node);
  };

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    el.style.setProperty('--sortable-transform', CSS.Transform.toString(transform) || 'none');
    el.style.setProperty('--sortable-transition', isDragging ? 'none' : (transition ?? 'none'));
    el.style.setProperty('--sortable-opacity', isDragging ? '0.4' : '1');
  }, [transform, transition, isDragging]);

  const handleEdit = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onEdit?.();
  };

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete?.();
  };

  return (
    <div ref={setRefs} className={`sortable-item-wrapper ${isDragging ? 'dragging' : ''}`}>
      <MethodListItem
        name={name}
        isActive={isActive}
        isEditable={isEditable}
        onClick={onClick}
        onEdit={onEdit ? handleEdit : undefined}
        onDelete={onDelete ? handleDelete : undefined}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
};

export default SortableMethodListItem;
