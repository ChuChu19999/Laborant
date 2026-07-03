import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MethodListItem } from '../../MethodListItem';
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

const SortableMethodListItem: React.FC<SortableMethodListItemProps> = ({
  id,
  name,
  isActive,
  isEditable,
  onClick,
  onEdit,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onEdit?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete?.();
  };

  return (
    <div
      ref={setNodeRef}
      className={`sortable-item-wrapper ${isDragging ? 'dragging' : ''}`}
      style={
        {
          '--sortable-transform': CSS.Transform.toString(transform),
          '--sortable-transition': isDragging ? 'none' : transition,
          '--sortable-opacity': isDragging ? '0.4' : '1',
        } as React.CSSProperties
      }
    >
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
