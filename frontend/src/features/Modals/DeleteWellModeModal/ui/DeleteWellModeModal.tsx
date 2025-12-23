import React, { useCallback } from 'react';
import { ConfirmationModal } from '../../../../entities/ConfirmationModal';
import { useDeleteWellMode } from '../../../../shared/model/hooks';
import type { WellMode } from '../../../../shared/api/samplingLocations';

interface DeleteWellModeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  wellMode: WellMode | null;
}

const DeleteWellModeModal: React.FC<DeleteWellModeModalProps> = ({
  open,
  onClose,
  onSuccess,
  wellMode,
}) => {
  const deleteWellModeMutation = useDeleteWellMode();

  const handleConfirm = useCallback(async () => {
    if (wellMode) {
      await deleteWellModeMutation.mutateAsync(wellMode.id);
      onSuccess();
    }
  }, [wellMode, deleteWellModeMutation, onSuccess]);

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
