import { useDeleteTestPurpose } from '@/entities/TestPurpose';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import type { TestPurpose } from '@/entities/TestPurpose';

interface DeleteTestPurposeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  testPurpose: TestPurpose | null;
}

const DeleteTestPurposeModal = ({
  open,
  onClose,
  onSuccess,
  testPurpose,
}: DeleteTestPurposeModalProps) => {
  const deleteTestPurposeMutation = useDeleteTestPurpose();

  const handleConfirm = async () => {
    if (testPurpose) {
      await deleteTestPurposeMutation.mutateAsync(testPurpose.id);
      onSuccess();
    }
  };

  if (!testPurpose) {
    return null;
  }

  return (
    <ConfirmationModal
      open={open}
      title="Удаление цели испытаний"
      message={`Вы действительно хотите удалить цель испытаний "${testPurpose.name}"?`}
      confirmText="Подтвердить"
      cancelText="Отмена"
      onConfirm={handleConfirm}
      onCancel={onClose}
      modalWidth="450"
    />
  );
};

export default DeleteTestPurposeModal;
