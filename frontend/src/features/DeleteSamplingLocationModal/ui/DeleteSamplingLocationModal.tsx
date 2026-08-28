import { useDeleteSamplingLocation } from '@/entities/SamplingLocation';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import type { SamplingLocation } from '@/entities/SamplingLocation';

interface DeleteSamplingLocationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  location: SamplingLocation | null;
}

const DeleteSamplingLocationModal = ({
  open,
  onClose,
  onSuccess,
  location,
}: DeleteSamplingLocationModalProps) => {
  const deleteSamplingLocationMutation = useDeleteSamplingLocation();

  const handleConfirm = async () => {
    if (location) {
      await deleteSamplingLocationMutation.mutateAsync(location.id);
      onSuccess();
    }
  };

  if (!location) {
    return null;
  }

  return (
    <ConfirmationModal
      open={open}
      title="Удаление места отбора пробы"
      message={`Вы действительно хотите удалить место отбора пробы "${location.name}"?`}
      confirmText="Подтвердить"
      cancelText="Отмена"
      onConfirm={handleConfirm}
      onCancel={onClose}
      modalWidth="450"
    />
  );
};

export default DeleteSamplingLocationModal;
