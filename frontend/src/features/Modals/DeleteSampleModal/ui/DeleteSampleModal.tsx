import React, { useCallback } from 'react';
import { ConfirmationModal } from '../../../../entities/ConfirmationModal';
import { useDeleteSample } from '../../../../shared/model/hooks';
import type { Sample } from '../../../../shared/api/samples';

interface DeleteSampleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sample: Sample | null;
}

const DeleteSampleModal: React.FC<DeleteSampleModalProps> = ({
  open,
  onClose,
  onSuccess,
  sample,
}) => {
  const deleteSampleMutation = useDeleteSample();

  const handleConfirm = useCallback(async () => {
    if (sample) {
      await deleteSampleMutation.mutateAsync(sample.id);
      onSuccess();
    }
  }, [sample, deleteSampleMutation, onSuccess]);

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
