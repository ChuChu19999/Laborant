import { useDeleteLaboratory } from '@/entities/Laboratory';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import type { Laboratory } from '@/entities/Laboratory';

interface DeleteLaboratoryModalProps {
  open: boolean;
  laboratory: Laboratory | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const DeleteLaboratoryModal = ({
  open,
  laboratory,
  onClose,
  onSuccess,
}: DeleteLaboratoryModalProps) => {
  const deleteLaboratoryMutation = useDeleteLaboratory();

  const handleConfirm = async () => {
    if (!laboratory) {
      return;
    }
    await deleteLaboratoryMutation.mutateAsync(laboratory.id);
    onSuccess?.();
    onClose();
  };

  if (!laboratory) {
    return null;
  }

  return (
    <ConfirmationModal
      open={open}
      title="Удаление лаборатории"
      message={`Вы действительно хотите удалить лабораторию «${laboratory.name}»?`}
      confirmText="Подтвердить"
      cancelText="Отмена"
      onConfirm={handleConfirm}
      onCancel={onClose}
      modalWidth="450"
    />
  );
};

export default DeleteLaboratoryModal;
