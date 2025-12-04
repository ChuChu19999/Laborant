import React from 'react';
import { ExperimentOutlined } from '@ant-design/icons';
import Button from '../../Button/Button';
import './LaboratoryCard.css';

interface Laboratory {
  name: string;
  description?: string;
  full_name?: string;
  laboratory_location?: string;
}

interface LaboratoryCardProps {
  laboratory: Laboratory;
  onClick?: (laboratory: Laboratory) => void;
  showActions?: boolean;
  onEdit?: (laboratory: Laboratory, e: React.MouseEvent) => void;
  onDelete?: (laboratory: Laboratory, e: React.MouseEvent) => void;
}

const LaboratoryCard = ({
  laboratory,
  onClick,
  showActions = false,
  onEdit,
  onDelete,
}: LaboratoryCardProps) => {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(laboratory, e);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(laboratory, e);
  };

  return (
    <div className="laboratory-card" onClick={() => onClick?.(laboratory)}>
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
      {showActions && (
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
