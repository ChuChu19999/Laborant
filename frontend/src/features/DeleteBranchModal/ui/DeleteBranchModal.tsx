import { useDeleteBranch } from '@/entities/Branch';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import type { Branch } from '@/entities/Branch';

interface DeleteBranchModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branch: Branch | null;
}

const DeleteBranchModal = ({ open, onClose, onSuccess, branch }: DeleteBranchModalProps) => {
  const deleteBranchMutation = useDeleteBranch();

  const handleConfirm = async () => {
    if (branch) {
      await deleteBranchMutation.mutateAsync(branch.id);
      onSuccess();
    }
  };

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
