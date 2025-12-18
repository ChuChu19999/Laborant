import React, { useCallback } from 'react';
import { ConfirmationModal } from '../../../../entities/ConfirmationModal';
import { useDeleteEquipment } from '../../../../shared/model/hooks';
import type { Equipment } from '../../../../shared/api/equipment';

interface DeleteEquipmentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  equipment: Equipment | null;
}

const DeleteEquipmentModal: React.FC<DeleteEquipmentModalProps> = ({
  open,
  onClose,
  onSuccess,
  equipment,
}) => {
  const deleteEquipmentMutation = useDeleteEquipment();

  const handleConfirm = useCallback(async () => {
    if (equipment) {
      await deleteEquipmentMutation.mutateAsync(equipment.id);
      onSuccess();
    }
  }, [equipment, deleteEquipmentMutation, onSuccess]);

  if (!equipment) {
    return null;
  }

  const equipmentName = equipment.name || 'без названия';

  return (
    <ConfirmationModal
      open={open}
      title="Удаление прибора"
      message={`Вы действительно хотите удалить прибор "${equipmentName}"?`}
      confirmText="Подтвердить"
      cancelText="Отмена"
      onConfirm={handleConfirm}
      onCancel={onClose}
      modalWidth="450"
    />
  );
};

export default DeleteEquipmentModal;
