import React from 'react';
import { ExperimentOutlined, SettingOutlined } from '@ant-design/icons';
import { Dropdown } from 'antd';
import Button from '../../Button';
import Tooltip from '../../Tooltip';
import type { Laboratory as LaboratoryType } from '../../../api/laboratories';
import type { MenuProps } from 'antd';
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

  const showSettings = Boolean(settingsMenuItems?.length) && !disabled;

  return (
    <div
      className={`laboratory-card${disabled ? ' laboratory-card--disabled' : ''}`}
      onClick={() => {
        if (!disabled) {
          onClick?.(laboratory);
        }
      }}
      aria-disabled={disabled}
    >
      {showSettings && (
        <div className="laboratory-card-settings" onClick={e => e.stopPropagation()}>
          <Dropdown menu={{ items: settingsMenuItems }} trigger={['click']}>
            <Tooltip title="Настройки" placement="top">
              <button
                type="button"
                className="laboratory-card-settings-button"
                aria-label="Настройки"
              >
                <SettingOutlined />
              </button>
            </Tooltip>
          </Dropdown>
        </div>
      )}
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
      {showActions && !disabled && (
        <div className="laboratory-card-actions" onClick={e => e.stopPropagation()}>
          <div className="button-wrapper">
            <Button
              title="Редактировать"
              onClick={handleEdit}
              type="default"
              className="edit-btn"
            />
          </div>
          <div className="button-wrapper">
            <Button
              title="Удалить"
              onClick={handleDelete}
              type="default"
              danger
              className="delete-btn"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LaboratoryCard;
