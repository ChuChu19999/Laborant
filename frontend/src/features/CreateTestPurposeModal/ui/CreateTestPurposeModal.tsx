import { TestPurposeFormFields } from '@/entities/TestPurpose';
import { Modal } from '@/shared/ui/Modal';
import { useCreateTestPurposeModal } from '../model/useCreateTestPurposeModal';

interface CreateTestPurposeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  laboratoryId?: number;
  departmentId?: number;
}

const CreateTestPurposeModal = ({
  open,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
}: CreateTestPurposeModalProps) => {
  const modal = useCreateTestPurposeModal({
    open,
    onClose,
    onSuccess,
    laboratoryId,
    departmentId,
  });

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Добавление цели испытаний"
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

export default CreateTestPurposeModal;
