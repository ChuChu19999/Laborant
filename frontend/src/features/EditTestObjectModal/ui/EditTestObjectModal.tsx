import { TestObjectFormFields } from '@/entities/TestObject';
import { Modal } from '@/shared/ui/Modal';
import { useEditTestObjectModal } from '../model/useEditTestObjectModal';
import type { TestObjectCatalogItem } from '@/entities/TestObject';

interface EditTestObjectModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  testObject: TestObjectCatalogItem | null;
}

const EditTestObjectModal = ({
  open,
  onClose,
  onSuccess,
  testObject,
}: EditTestObjectModalProps) => {
  const modal = useEditTestObjectModal({ open, onClose, onSuccess, testObject });

  if (!open || !testObject) {
    return null;
  }

  return (
    <Modal
      header="Редактирование объекта испытаний"
      onClose={modal.handleCancel}
      onCancel={modal.handleCancel}
      onSave={modal.handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <TestObjectFormFields
        value={modal.formData}
        onChange={modal.handleChange}
        errors={modal.errors}
      />
    </Modal>
  );
};

export default EditTestObjectModal;
