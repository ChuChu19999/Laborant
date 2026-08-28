import { DepartmentFormFields } from '@/entities/Department';
import { Modal } from '@/shared/ui/Modal';
import { useEditDepartmentModal } from '../model/useEditDepartmentModal';
import type { Department } from '@/entities/Department';

interface EditDepartmentModalProps {
  open: boolean;
  department: Department | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditDepartmentModal = ({
  open,
  department,
  onClose,
  onSuccess,
}: EditDepartmentModalProps) => {
  const modal = useEditDepartmentModal({ open, department, onClose, onSuccess });

  if (!open || !department) {
    return null;
  }

  return (
    <Modal
      header="Редактирование подразделения"
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

export default EditDepartmentModal;
