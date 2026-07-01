import React from 'react';
import { EditOutlined } from '@ant-design/icons';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import './MethodListItem.css';

interface MethodListItemProps {
  name: string;
  isActive?: boolean;
  isEditable?: boolean;
  onClick?: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  onDisconnect?: (e: React.MouseEvent) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

const MethodListItem: React.FC<MethodListItemProps> = ({
  name,
  isActive = false,
  isEditable = false,
  onClick,
  onEdit,
  onDelete,
  onDisconnect,
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
        <div className="method-list-item-actions">
          {onEdit && (
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
              title="Редактировать метод"
            >
              <EditOutlined />
            </button>
          )}
          {onDisconnect && (
            <button
              className="method-list-item-disconnect"
              onClick={e => {
                e.stopPropagation();
                onDisconnect(e);
              }}
              onPointerDown={e => {
                e.stopPropagation();
              }}
              type="button"
              title="Разорвать группу"
            >
              <LinkOffIcon className="method-list-item-disconnect-icon" />
            </button>
          )}
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
