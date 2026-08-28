import { BranchFormFields } from '@/entities/Branch';
import { Modal } from '@/shared/ui/Modal';
import { useCreateBranchModal } from '../model/useCreateBranchModal';

interface CreateBranchModalProps {
  open: boolean;
  laboratoryId: number;
  departmentId?: number;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateBranchModal = ({
  open,
  laboratoryId,
  departmentId,
  onClose,
  onSuccess,
}: CreateBranchModalProps) => {
  const modal = useCreateBranchModal({
    open,
    laboratoryId,
    departmentId,
    onClose,
    onSuccess,
  });

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Добавление филиала"
      onClose={modal.handleClose}
      onCancel={modal.handleClose}
      onSave={modal.handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <BranchFormFields
        value={modal.formData}
        onChange={modal.handleFieldChange}
        errors={modal.errors}
      />
    </Modal>
  );
};

export default CreateBranchModal;
