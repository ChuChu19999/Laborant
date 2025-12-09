import React from 'react';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import './MethodListItem.css';

interface MethodListItemProps {
  name: string;
  isActive?: boolean;
  isEditable?: boolean;
  onClick?: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

const MethodListItem: React.FC<MethodListItemProps> = ({
  name,
  isActive = false,
  isEditable = false,
  onClick,
  onDelete,
  dragHandleProps,
}) => {
  const displayName =
    name === 'Фракционный состав (конденсат)'
      ? 'Конденсат'
      : name === 'Фракционный состав (нефть)'
        ? 'Нефть'
        : name;

  if (isEditable) {
    return (
      <div
        className={`method-list-item method-list-item-editable ${isActive ? 'active' : ''}`}
        onClick={onClick}
      >
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="method-list-item-drag-handle"
            onPointerDown={e => {
              e.stopPropagation();
              if (dragHandleProps.onPointerDown) {
                dragHandleProps.onPointerDown(e);
              }
            }}
            onClick={e => {
              e.stopPropagation();
            }}
          >
            <DragIndicatorIcon className="drag-indicator-icon" />
          </div>
        )}
        <div className="method-list-item-content">
          <span className="method-list-item-name">{displayName}</span>
        </div>
        {onDelete && (
          <button
            className="method-list-item-delete"
            onClick={e => {
              e.stopPropagation();
              onDelete(e);
            }}
            onPointerDown={e => {
              e.stopPropagation();
            }}
            type="button"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`method-list-item method-list-item-non-editable ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="method-list-item-content">
        <span className="method-list-item-name">{displayName}</span>
      </div>
      <div className="method-list-item-indicator" />
    </div>
  );
};

export default MethodListItem;
