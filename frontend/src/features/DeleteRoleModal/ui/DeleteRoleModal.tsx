import { useDeleteRole } from '@/entities/Role';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import type { RoleCatalogItem } from '@/entities/Role';

interface DeleteRoleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  role: RoleCatalogItem | null;
}

const DeleteRoleModal = ({ open, onClose, onSuccess, role }: DeleteRoleModalProps) => {
  const deleteMutation = useDeleteRole();

  const handleConfirm = async () => {
    if (role) {
      await deleteMutation.mutateAsync(role.id);
      onSuccess();
    }
  };

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
