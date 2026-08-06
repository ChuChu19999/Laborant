import React from 'react';
import {
  DeploymentUnitOutlined,
  ClusterOutlined,
  BranchesOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Dropdown } from 'antd';
import Button from '../../Button';
import Tooltip from '../../Tooltip';
import type { Department as DepartmentType } from '../../../api/laboratories';
import type { MenuProps } from 'antd';
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
  const DeptIcon = deptIcons[iconIndex % deptIcons.length];
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

  return (
    <div
      className={`department-card${disabled ? ' department-card--disabled' : ''}`}
      onClick={() => {
        if (!disabled) {
          onClick?.(department);
        }
      }}
      aria-disabled={disabled}
    >
      {showSettings && (
        <div className="department-card-settings" onClick={e => e.stopPropagation()}>
          <Dropdown menu={{ items: settingsMenuItems }} trigger={['click']}>
            <Tooltip title="Настройки" placement="top">
              <button
                type="button"
                className="department-card-settings-button"
                aria-label="Настройки"
              >
                <SettingOutlined />
              </button>
            </Tooltip>
          </Dropdown>
        </div>
      )}
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
      {showActions && !disabled && (onEdit || onDelete) && (
        <div className="department-card-actions" onClick={e => e.stopPropagation()}>
          {onEdit && (
            <div className="button-wrapper">
              <Button
                title="Редактировать"
                onClick={handleEdit}
                type="default"
                className="edit-btn"
              />
            </div>
          )}
          {onDelete && (
            <div className="button-wrapper">
              <Button
                title="Удалить"
                onClick={handleDelete}
                type="default"
                danger
                className="delete-btn"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DepartmentCard;
