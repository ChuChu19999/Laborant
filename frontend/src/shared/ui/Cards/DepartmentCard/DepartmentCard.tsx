import React from 'react';
import { DeploymentUnitOutlined, ClusterOutlined, BranchesOutlined } from '@ant-design/icons';
import Button from '../../Button';
import type { Department as DepartmentType } from '../../../api/laboratories';
import './DepartmentCard.css';

const deptIcons = [DeploymentUnitOutlined, ClusterOutlined, BranchesOutlined];

type Department = DepartmentType;

interface DepartmentCardProps {
  department: Department;
  onClick?: (department: Department) => void;
  showActions?: boolean;
  onEdit?: (department: Department, e: React.MouseEvent) => void;
  onDelete?: (department: Department, e: React.MouseEvent) => void;
  iconIndex?: number;
  disabled?: boolean;
}

const DepartmentCard = ({
  department,
  onClick,
  showActions = false,
  onEdit,
  onDelete,
  iconIndex = 0,
  disabled = false,
}: DepartmentCardProps) => {
  const DeptIcon = deptIcons[iconIndex % deptIcons.length];

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
      {showActions && !disabled && (
        <div className="department-card-actions" onClick={e => e.stopPropagation()}>
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

export default DepartmentCard;
