import React, { useCallback } from 'react';
import { ConfirmationModal } from '../../../../entities/ConfirmationModal';
import { useDeleteSamplingLocation } from '../../../../shared/model/hooks';
import type { SamplingLocation } from '../../../../shared/api/samplingLocations';

interface DeleteSamplingLocationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  location: SamplingLocation | null;
}

const DeleteSamplingLocationModal: React.FC<DeleteSamplingLocationModalProps> = ({
  open,
  onClose,
  onSuccess,
  location,
}) => {
  const deleteSamplingLocationMutation = useDeleteSamplingLocation();

  const handleConfirm = useCallback(async () => {
    if (location) {
      await deleteSamplingLocationMutation.mutateAsync(location.id);
      onSuccess();
    }
  }, [location, deleteSamplingLocationMutation, onSuccess]);

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
