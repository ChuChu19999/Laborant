import { useDeleteNdNorm } from '@/entities/NdNorm';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import type { NdNorm } from '@/entities/NdNorm';

interface DeleteNdNormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ndNorm: NdNorm | null;
}

const DeleteNdNormModal = ({ open, onClose, onSuccess, ndNorm }: DeleteNdNormModalProps) => {
  const deleteNdNormMutation = useDeleteNdNorm();

  const handleConfirm = async () => {
    if (ndNorm) {
      await deleteNdNormMutation.mutateAsync(ndNorm.id);
      onSuccess();
    }
  };

  if (!ndNorm) {
    return null;
  }

  const ndNormName = ndNorm.name || 'без названия';

  return (
    <ConfirmationModal
      open={open}
      title="Удаление нормы НД"
      message={`Вы действительно хотите удалить норму НД "${ndNormName}"?`}
      confirmText="Подтвердить"
      cancelText="Отмена"
      onConfirm={handleConfirm}
      onCancel={onClose}
      modalWidth="450"
    />
  );
};

export default DeleteNdNormModal;
