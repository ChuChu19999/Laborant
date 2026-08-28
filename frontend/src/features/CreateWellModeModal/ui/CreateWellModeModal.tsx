import { WellModeFormFields } from '@/entities/WellMode';
import { Modal } from '@/shared/ui/Modal';
import { useCreateWellModeModal } from '../model/useCreateWellModeModal';

interface CreateWellModeModalProps {
  open: boolean;
  branchId: number;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateWellModeModal = ({ open, branchId, onClose, onSuccess }: CreateWellModeModalProps) => {
  const modal = useCreateWellModeModal({ open, branchId, onClose, onSuccess });

  if (!open) {
    return null;
  }

  return (
    <Modal
      header="Добавление режима скважины"
      onClose={modal.handleClose}
      onCancel={modal.handleClose}
      onSave={modal.handleSave}
      saveButtonText="Сохранить"
      showEditButton={false}
      editable={false}
      modalWidth="550"
    >
      <WellModeFormFields
        value={modal.formData}
        onChange={modal.handleFieldChange}
        errors={modal.errors}
      />
    </Modal>
  );
};

export default CreateWellModeModal;
