import { useDeleteSampleType } from '@/entities/SampleType';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import type { SampleType } from '@/entities/SampleType';

interface DeleteSampleTypeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sampleType: SampleType | null;
}

const DeleteSampleTypeModal = ({
  open,
  onClose,
  onSuccess,
  sampleType,
}: DeleteSampleTypeModalProps) => {
  const deleteSampleTypeMutation = useDeleteSampleType();

  const handleConfirm = async () => {
    if (sampleType) {
      await deleteSampleTypeMutation.mutateAsync(sampleType.id);
      onSuccess();
    }
  };

  if (!sampleType) {
    return null;
  }

  return (
    <ConfirmationModal
      open={open}
      title="Удаление типа пробы"
      message={`Вы действительно хотите удалить тип пробы "${sampleType.name}"?`}
      confirmText="Подтвердить"
      cancelText="Отмена"
      onConfirm={handleConfirm}
      onCancel={onClose}
      modalWidth="450"
    />
  );
};

export default DeleteSampleTypeModal;
