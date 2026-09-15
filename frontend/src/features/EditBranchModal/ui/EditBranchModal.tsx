import { BranchFormFields } from '@/entities/Branch';
import { Modal } from '@/shared/ui/Modal';
import { useEditBranchModal } from '../model/useEditBranchModal';
import type { Branch } from '@/entities/Branch';

interface EditBranchModalProps {
  open: boolean;
  branch: Branch | null;
  showPhone: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const EditBranchModal = ({ open, branch, showPhone, onClose, onSuccess }: EditBranchModalProps) => {
  const modal = useEditBranchModal({ open, branch, showPhone, onClose, onSuccess });

  if (!open || !branch) {
    return null;
  }

  return (
    <Modal
      header="Редактирование филиала"
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
        showPhone={showPhone}
      />
    </Modal>
  );
};

export default EditBranchModal;
