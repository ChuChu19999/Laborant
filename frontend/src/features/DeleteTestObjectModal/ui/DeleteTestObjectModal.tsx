import { useDeleteTestObject } from '@/entities/TestObject';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';
import type { TestObjectCatalogItem } from '@/entities/TestObject';

interface DeleteTestObjectModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  testObject: TestObjectCatalogItem | null;
}

const DeleteTestObjectModal = ({
  open,
  onClose,
  onSuccess,
  testObject,
}: DeleteTestObjectModalProps) => {
  const deleteMutation = useDeleteTestObject();

  const handleConfirm = async () => {
    if (testObject) {
      await deleteMutation.mutateAsync(testObject.id);
      onSuccess();
    }
  };

  if (!testObject) {
    return null;
  }

  return (
    <ConfirmationModal
      open={open}
      title="Удаление объекта испытаний"
      message={`Вы действительно хотите удалить объект испытаний "${testObject.name}"?`}
      confirmText="Подтвердить"
      cancelText="Отмена"
      onConfirm={handleConfirm}
      onCancel={onClose}
      modalWidth="450"
    />
  );
};

export default DeleteTestObjectModal;
