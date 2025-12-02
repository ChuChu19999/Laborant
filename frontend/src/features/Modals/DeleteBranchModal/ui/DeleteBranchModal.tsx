import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { laboratoryApi, type BranchResponse } from '../../../../shared/api/laboratory';
import Modal from '../../../../shared/ui/Modal/ui/Modal';
import './DeleteBranchModal.css';

interface DeleteBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  branch: BranchResponse | null;
}

const DeleteBranchModal: React.FC<DeleteBranchModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  branch,
}) => {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: number) => laboratoryApi.deleteBranch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      message.success('Филиал успешно удален');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: unknown) => {
      console.error('Ошибка при удалении филиала:', error);
      message.error('Не удалось удалить филиал');
    },
  });

  const handleDelete = useCallback(() => {
    if (!branch) {
      message.error('Филиал не выбран');
      return;
    }

    deleteMutation.mutate(branch.id);
  }, [branch, deleteMutation]);

  const handleClose = useCallback(() => {
    if (!deleteMutation.isPending) {
      onClose();
    }
  }, [deleteMutation.isPending, onClose]);

  if (!isOpen || !branch) return null;

  return (
    <>
      <div className="modal-overlay" onClick={handleClose} />
      <div className="modal-wrapper-custom">
        <Modal
          header="Удаление филиала"
          onClose={handleClose}
          onCancel={handleClose}
          onDelete={handleDelete}
          deleteTitle="Удалить"
          showEditButton={false}
          editable={false}
        >
          <div className="delete-branch-confirmation">
            <div className="confirmation-content">
              <p className="confirmation-text">
                Вы действительно хотите удалить филиал &quot;{branch.name}&quot;?
              </p>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
};

export default DeleteBranchModal;
