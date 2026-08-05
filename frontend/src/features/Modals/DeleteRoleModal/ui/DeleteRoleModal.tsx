import React, { useCallback } from 'react';
import { ConfirmationModal } from '../../../../entities/ConfirmationModal';
import { useDeleteRole } from '../../../../shared/model/hooks';
import type { RoleCatalogItem } from '../../../../shared/api/roles';

interface DeleteRoleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  role: RoleCatalogItem | null;
}

const DeleteRoleModal: React.FC<DeleteRoleModalProps> = ({ open, onClose, onSuccess, role }) => {
  const deleteMutation = useDeleteRole();

  const handleConfirm = useCallback(async () => {
    if (role) {
      await deleteMutation.mutateAsync(role.id);
      onSuccess();
    }
  }, [role, deleteMutation, onSuccess]);

  if (!role) {
    return null;
  }

  return (
    <ConfirmationModal
      open={open}
      title="Удаление роли"
      message={`Вы действительно хотите удалить роль "${role.name}"?`}
      confirmText="Подтвердить"
      cancelText="Отмена"
      onConfirm={handleConfirm}
      onCancel={onClose}
      modalWidth="450"
    />
  );
};

export default DeleteRoleModal;
