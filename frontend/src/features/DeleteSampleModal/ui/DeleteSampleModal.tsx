import { useDeleteSample } from '@/entities/Sample';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import type { Sample } from '@/entities/Sample';

interface DeleteSampleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sample: Sample | null;
}

const DeleteSampleModal = ({ open, onClose, onSuccess, sample }: DeleteSampleModalProps) => {
  const deleteSampleMutation = useDeleteSample();

  const handleConfirm = async () => {
    if (sample) {
      await deleteSampleMutation.mutateAsync(sample.id);
      onSuccess();
    }
  };

  if (!sample) {
    return null;
  }

  return (
    <ConfirmationModal
      open={open}
      title="Удаление пробы"
      message={`Вы действительно хотите удалить пробу №${sample.registration_number}?`}
      confirmText="Подтвердить"
      cancelText="Отмена"
      onConfirm={handleConfirm}
      onCancel={onClose}
      modalWidth="450"
    />
  );
};

export default DeleteSampleModal;
