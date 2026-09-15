import { TestPurposeFormFields } from '@/entities/TestPurpose';
import { Modal } from '@/shared/ui/Modal';
import { useEditTestPurposeModal } from '../model/useEditTestPurposeModal';
import type { TestPurpose } from '@/entities/TestPurpose';

interface EditTestPurposeModalProps {
  open: boolean;
  testPurpose: TestPurpose | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditTestPurposeModal = ({
  open,
  testPurpose,
  onClose,
  onSuccess,
}: EditTestPurposeModalProps) => {
  const modal = useEditTestPurposeModal({ open, testPurpose, onClose, onSuccess });

  if (!open || !testPurpose) {
    return null;
  }

  return (
    <Modal
      header="Редактирование цели испытаний"
      onClose={modal.handleClose}
      onCancel={modal.handleClose}
      onSave={modal.handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <TestPurposeFormFields
        value={modal.formData}
        onChange={modal.handleFieldChange}
        errors={modal.errors}
      />
    </Modal>
  );
};

export default EditTestPurposeModal;
