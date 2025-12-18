import React, { useCallback } from 'react';
import { ConfirmationModal } from '../../../../entities/ConfirmationModal';
import { useDeleteBranch } from '../../../../shared/model/hooks';
import type { Branch } from '../../../../shared/api/samplingLocations';

interface DeleteBranchModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branch: Branch | null;
}

const DeleteBranchModal: React.FC<DeleteBranchModalProps> = ({
  open,
  onClose,
  onSuccess,
  branch,
}) => {
  const deleteBranchMutation = useDeleteBranch();

  const handleConfirm = useCallback(async () => {
    if (branch) {
      await deleteBranchMutation.mutateAsync(branch.id);
      onSuccess();
    }
  }, [branch, deleteBranchMutation, onSuccess]);

  if (!branch) {
    return null;
  }

  return (
    <ConfirmationModal
      open={open}
      title="Удаление филиала"
      message={`Вы действительно хотите удалить филиал "${branch.name}"?`}
      confirmText="Подтвердить"
      cancelText="Отмена"
      onConfirm={handleConfirm}
      onCancel={onClose}
      modalWidth="450"
    />
  );
};

export default DeleteBranchModal;
