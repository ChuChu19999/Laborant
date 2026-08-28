import { TestObjectFormFields } from '@/entities/TestObject';
import { Modal } from '@/shared/ui/Modal';
import { useCreateTestObjectModal } from '../model/useCreateTestObjectModal';

interface CreateTestObjectModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateTestObjectModal = ({ open, onClose, onSuccess }: CreateTestObjectModalProps) => {
  const modal = useCreateTestObjectModal({ open, onClose, onSuccess });

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Добавление объекта испытаний"
      onClose={onClose}
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

export default CreateTestObjectModal;
