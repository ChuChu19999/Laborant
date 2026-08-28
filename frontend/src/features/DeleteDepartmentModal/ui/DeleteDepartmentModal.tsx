import { useDeleteDepartment } from '@/entities/Department';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import type { Department } from '@/entities/Department';

interface DeleteDepartmentModalProps {
  open: boolean;
  department: Department | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const DeleteDepartmentModal = ({
  open,
  department,
  onClose,
  onSuccess,
}: DeleteDepartmentModalProps) => {
  const deleteDepartmentMutation = useDeleteDepartment();

  const handleConfirm = async () => {
    if (!department) {
      return;
    }
    await deleteDepartmentMutation.mutateAsync(department.id);
    onSuccess?.();
    onClose();
  };

  if (!department) {
    return null;
  }

  return (
    <ConfirmationModal
      open={open}
      title="Удаление подразделения"
      message={`Вы действительно хотите удалить подразделение «${department.name}»?`}
      confirmText="Подтвердить"
      cancelText="Отмена"
      onConfirm={handleConfirm}
      onCancel={onClose}
      modalWidth="450"
    />
  );
};

export default DeleteDepartmentModal;
