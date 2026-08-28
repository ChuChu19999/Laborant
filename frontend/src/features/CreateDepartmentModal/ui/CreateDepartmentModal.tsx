import { DepartmentFormFields } from '@/entities/Department';
import { Modal } from '@/shared/ui/Modal';
import { useCreateDepartmentModal } from '../model/useCreateDepartmentModal';

interface CreateDepartmentModalProps {
  open: boolean;
  laboratoryId: number;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateDepartmentModal = ({
  open,
  laboratoryId,
  onClose,
  onSuccess,
}: CreateDepartmentModalProps) => {
  const modal = useCreateDepartmentModal({
    open,
    laboratoryId,
    onClose,
    onSuccess,
  });

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Добавление подразделения"
      onClose={modal.handleClose}
      onCancel={modal.handleClose}
      onSave={modal.handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <DepartmentFormFields
        value={modal.formData}
        onChange={modal.handleFieldChange}
        errors={modal.errors}
      />
    </Modal>
  );
};

export default CreateDepartmentModal;
