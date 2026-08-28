import { useDeleteWellMode } from '@/entities/WellMode';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import type { WellMode } from '@/entities/WellMode';

interface DeleteWellModeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  wellMode: WellMode | null;
}

const DeleteWellModeModal = ({ open, onClose, onSuccess, wellMode }: DeleteWellModeModalProps) => {
  const deleteWellModeMutation = useDeleteWellMode();

  const handleConfirm = async () => {
    if (wellMode) {
      await deleteWellModeMutation.mutateAsync(wellMode.id);
      onSuccess();
    }
  };

  if (!wellMode) {
    return null;
  }

  return (
    <ConfirmationModal
      open={open}
      title="Удаление режима скважины"
      message={`Вы действительно хотите удалить режим скважины "${wellMode.name}"?`}
      confirmText="Подтвердить"
      cancelText="Отмена"
      onConfirm={handleConfirm}
      onCancel={onClose}
      modalWidth="450"
    />
  );
};

export default DeleteWellModeModal;
