import React from 'react';
import './MethodListItem.css';

interface MethodListItemProps {
  name: string;
  isActive?: boolean;
  isEditable?: boolean;
  onClick?: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}

const MethodListItem: React.FC<MethodListItemProps> = ({
  name,
  isActive = false,
  isEditable = false,
  onClick,
  onDelete,
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
