import { EditOutlined, HolderOutlined } from '@/shared/ui/icons';
import { Tooltip } from '@/shared/ui/Tooltip';
import type { HTMLAttributes, KeyboardEvent, MouseEvent } from 'react';
import './MethodListItem.css';

interface MethodListItemProps {
  name: string;
  isActive?: boolean;
  isEditable?: boolean;
  onClick?: () => void;
  onEdit?: (e: MouseEvent) => void;
  onDelete?: (e: MouseEvent) => void;
  dragHandleProps?: HTMLAttributes<HTMLDivElement>;
}

const activateOnKeyDown = (e: KeyboardEvent, onClick?: () => void) => {
  if (!onClick) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onClick();
  }
};

const MethodListItem = ({
  name,
  isActive = false,
  isEditable = false,
  onClick,
  onEdit,
  onDelete,
  dragHandleProps,
}: MethodListItemProps) => {
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
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={e => activateOnKeyDown(e, onClick)}
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
            <HolderOutlined className="drag-indicator-icon" />
          </div>
        )}
        <div className="method-list-item-content">
          <span className="method-list-item-name">{displayName}</span>
        </div>
        <div className="method-list-item-actions">
          {onEdit && (
            <Tooltip title="Редактировать метод" placement="top">
              <button
                className="method-list-item-edit"
                onClick={e => {
                  e.stopPropagation();
                  onEdit(e);
                }}
                onPointerDown={e => {
                  e.stopPropagation();
                }}
                type="button"
              >
                <EditOutlined className="method-list-item-edit-icon" />
              </button>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="Удалить метод" placement="top">
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
            </Tooltip>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`method-list-item method-list-item-non-editable ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="method-list-item-content">
        <span className="method-list-item-name">{displayName}</span>
      </div>
      <div className="method-list-item-indicator" />
    </button>
  );
};

export default MethodListItem;
