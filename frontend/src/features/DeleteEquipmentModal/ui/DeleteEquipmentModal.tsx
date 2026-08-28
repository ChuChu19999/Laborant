import { useDeleteEquipment } from '@/entities/Equipment';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import type { Equipment } from '@/entities/Equipment';

interface DeleteEquipmentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  equipment: Equipment | null;
}

const DeleteEquipmentModal = ({
  open,
  onClose,
  onSuccess,
  equipment,
}: DeleteEquipmentModalProps) => {
  const deleteEquipmentMutation = useDeleteEquipment();

  const handleConfirm = async () => {
    if (equipment) {
      await deleteEquipmentMutation.mutateAsync(equipment.id);
      onSuccess();
    }
  };

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
