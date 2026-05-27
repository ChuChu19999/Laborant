import React, { useCallback } from 'react';
import { ConfirmationModal } from '../../../../entities/ConfirmationModal';
import { useDeleteTestObject } from '../../../../shared/model/hooks';
import type { TestObjectCatalogItem } from '../../../../shared/api/testObjects';

interface DeleteTestObjectModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  testObject: TestObjectCatalogItem | null;
}

const DeleteTestObjectModal: React.FC<DeleteTestObjectModalProps> = ({
  open,
  onClose,
  onSuccess,
  testObject,
}) => {
  const deleteMutation = useDeleteTestObject();

  const handleConfirm = useCallback(async () => {
    if (testObject) {
      await deleteMutation.mutateAsync(testObject.id);
      onSuccess();
    }
  }, [testObject, deleteMutation, onSuccess]);

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
