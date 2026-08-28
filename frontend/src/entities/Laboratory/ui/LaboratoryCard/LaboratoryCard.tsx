import React from 'react';
import { Button } from '@/shared/ui/Button';
import { Dropdown } from '@/shared/ui/Dropdown';
import { ExperimentOutlined, SettingOutlined } from '@/shared/ui/icons';
import { Tooltip } from '@/shared/ui/Tooltip';
import type { Laboratory as LaboratoryType } from '../../api';
import type { MenuProps } from '@/shared/ui/Menu';
import './LaboratoryCard.css';

type Laboratory = LaboratoryType & {
  description?: string;
};

interface LaboratoryCardProps {
  laboratory: Laboratory;
  onClick?: (laboratory: Laboratory) => void;
  showActions?: boolean;
  onEdit?: (laboratory: Laboratory, e: React.MouseEvent) => void;
  onDelete?: (laboratory: Laboratory, e: React.MouseEvent) => void;
  settingsMenuItems?: MenuProps['items'];
  disabled?: boolean;
}

const LaboratoryCard = ({
  laboratory,
  onClick,
  showActions = false,
  onEdit,
  onDelete,
  settingsMenuItems,
  disabled = false,
}: LaboratoryCardProps) => {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) {
      return;
    }
    onEdit?.(laboratory, e);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) {
      return;
    }
    onDelete?.(laboratory, e);
  };

  const handleSelect = () => {
    if (!disabled) {
      onClick?.(laboratory);
    }
  };

  const showSettings = Boolean(settingsMenuItems?.length) && !disabled;
  const isSelectable = Boolean(onClick);

  const cardContent = (
    <div className="laboratory-card-content">
      <div className="laboratory-card-header">
        <ExperimentOutlined className="laboratory-icon" />
        <h3>{laboratory.name}</h3>
      </div>
      {laboratory.description && <p>{laboratory.description}</p>}
      {laboratory.full_name && (
        <div className="laboratory-info">
          <span>{laboratory.full_name}</span>
        </div>
      )}
      {laboratory.laboratory_location && (
        <div className="laboratory-info">
          <span>📍 {laboratory.laboratory_location}</span>
        </div>
      )}
    </div>
  );

  return (
    <article className={`laboratory-card${disabled ? ' laboratory-card--disabled' : ''}`}>
      {showSettings && (
        <div className="laboratory-card-settings">
          <Dropdown menu={{ items: settingsMenuItems }} trigger={['click']}>
            <Tooltip title="Настройки" placement="top">
              <button
                type="button"
                className="laboratory-card-settings-button"
                aria-label="Настройки"
              >
                <SettingOutlined className="laboratory-card-settings-icon" />
              </button>
            </Tooltip>
          </Dropdown>
        </div>
      )}
      {isSelectable ? (
        <button
          type="button"
          className="laboratory-card-select"
          onClick={handleSelect}
          disabled={disabled}
          aria-label={`Открыть лабораторию ${laboratory.name}`}
        >
          {cardContent}
        </button>
      ) : (
        cardContent
      )}
      {showActions && !disabled && (onEdit || onDelete) && (
        <div className="laboratory-card-actions">
          {onEdit && (
            <Button
              title="Редактировать"
              onClick={handleEdit}
              type="default"
              className="edit-btn"
            />
          )}
          {onDelete && (
            <Button
              title="Удалить"
              onClick={handleDelete}
              type="default"
              danger
              className="delete-btn"
            />
          )}
        </div>
      )}
    </article>
  );
};

export default LaboratoryCard;
