import React from 'react';
import { Button } from '@/shared/ui/Button';
import { Dropdown } from '@/shared/ui/Dropdown';
import {
  DeploymentUnitOutlined,
  ClusterOutlined,
  BranchesOutlined,
  SettingOutlined,
} from '@/shared/ui/icons';
import { Tooltip } from '@/shared/ui/Tooltip';
import type { Department as DepartmentType } from '../../api';
import type { MenuProps } from '@/shared/ui/Menu';
import './DepartmentCard.css';

const deptIcons = [DeploymentUnitOutlined, ClusterOutlined, BranchesOutlined];

type Department = DepartmentType;

interface DepartmentCardProps {
  department: Department;
  onClick?: (department: Department) => void;
  showActions?: boolean;
  onEdit?: (department: Department, e: React.MouseEvent) => void;
  onDelete?: (department: Department, e: React.MouseEvent) => void;
  settingsMenuItems?: MenuProps['items'];
  iconIndex?: number;
  disabled?: boolean;
}

const DepartmentCard = ({
  department,
  onClick,
  showActions = false,
  onEdit,
  onDelete,
  settingsMenuItems,
  iconIndex = 0,
  disabled = false,
}: DepartmentCardProps) => {
  const DeptIcon = deptIcons[iconIndex % deptIcons.length] ?? DeploymentUnitOutlined;
  const showSettings = Boolean(settingsMenuItems?.length) && !disabled;

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) {
      return;
    }
    onEdit?.(department, e);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) {
      return;
    }
    onDelete?.(department, e);
  };

  const handleSelect = () => {
    if (!disabled) {
      onClick?.(department);
    }
  };

  const isSelectable = Boolean(onClick);

  const cardContent = (
    <div className="department-card-content">
      <div className="department-card-header">
        <DeptIcon className="department-icon" />
        <h3>{department.name}</h3>
      </div>
      {department.laboratory_location && (
        <div className="laboratory-info">
          <span>📍 {department.laboratory_location}</span>
        </div>
      )}
    </div>
  );

  return (
    <article className={`department-card${disabled ? ' department-card--disabled' : ''}`}>
      {showSettings && (
        <div className="department-card-settings">
          <Dropdown menu={{ items: settingsMenuItems }} trigger={['click']}>
            <Tooltip title="Настройки" placement="top">
              <button
                type="button"
                className="department-card-settings-button"
                aria-label="Настройки"
              >
                <SettingOutlined className="department-card-settings-icon" />
              </button>
            </Tooltip>
          </Dropdown>
        </div>
      )}
      {isSelectable ? (
        <button
          type="button"
          className="department-card-select"
          onClick={handleSelect}
          disabled={disabled}
          aria-label={`Открыть подразделение ${department.name}`}
        >
          {cardContent}
        </button>
      ) : (
        cardContent
      )}
      {showActions && !disabled && (onEdit || onDelete) && (
        <div className="department-card-actions">
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

export default DepartmentCard;
