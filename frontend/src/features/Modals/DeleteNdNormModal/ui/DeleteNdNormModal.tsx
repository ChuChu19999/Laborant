import React, { useCallback } from 'react';
import { ConfirmationModal } from '../../../../entities/ConfirmationModal';
import { useDeleteNdNorm } from '../../../../shared/model/hooks';
import type { NdNorm } from '../../../../shared/api/ndNorms';

interface DeleteNdNormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ndNorm: NdNorm | null;
}

const DeleteNdNormModal: React.FC<DeleteNdNormModalProps> = ({
  open,
  onClose,
  onSuccess,
  ndNorm,
}) => {
  const deleteNdNormMutation = useDeleteNdNorm();

  const handleConfirm = useCallback(async () => {
    if (ndNorm) {
      await deleteNdNormMutation.mutateAsync(ndNorm.id);
      onSuccess();
    }
  }, [ndNorm, deleteNdNormMutation, onSuccess]);

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
