import { useDeleteResearchMethod, useDeleteResearchMethodGroup } from '@/entities/ResearchMethod';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';

export type DeleteResearchMethodTarget = {
  type: 'method' | 'group';
  id: number;
  name: string;
};

interface DeleteResearchMethodModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  target: DeleteResearchMethodTarget | null;
}

const DeleteResearchMethodModal = ({
  open,
  onClose,
  onSuccess,
  target,
}: DeleteResearchMethodModalProps) => {
  const deleteMethodMutation = useDeleteResearchMethod();
  const deleteGroupMutation = useDeleteResearchMethodGroup();

  const handleConfirm = async () => {
    if (!target) {
      return;
    }
    if (target.type === 'method') {
      await deleteMethodMutation.mutateAsync(target.id);
    } else {
      await deleteGroupMutation.mutateAsync(target.id);
    }
    onSuccess();
  };

  if (!target) {
    return null;
  }

  const isMethod = target.type === 'method';

  return (
    <ConfirmationModal
      open={open}
      title={isMethod ? 'Скрытие метода исследования' : 'Удаление группы методов'}
      message={
        isMethod
          ? `Вы действительно хотите скрыть метод исследования "${target.name}"?`
          : `Вы действительно хотите удалить группу "${target.name}"? Методы группы тоже будут скрыты.`
      }
      confirmText={isMethod ? 'Скрыть' : 'Удалить группу'}
      cancelText="Отмена"
      onConfirm={handleConfirm}
      onCancel={onClose}
      modalWidth="450"
    />
  );
};

export default DeleteResearchMethodModal;
